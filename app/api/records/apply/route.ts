/**
 * Apply Route — POST { proposalId, approvedFactIds }. Spec: `spec.md > Apply Route`.
 * The browser sends ONLY ids. The server reloads its own copy of the proposal and never trusts
 * fact contents from the browser. No approved facts → no Apply → nothing is persisted.
 *
 * Identity: the document id a proposal received at extraction is provisional — two proposals made from the same
 * trusted state can share it. The whole approval runs under the state lock and assigns the final document id from
 * the CURRENT state, so approved documents, facts and PDFs never collide, even for concurrent approvals.
 */
import { NextResponse } from "next/server";
import { readState, StateBusyError, withStateLock, writeState } from "@/lib/store/stateStore";
import { commitProposalDocument, deleteProposal, loadProposal } from "@/lib/store/proposalStore";
import { apply, rebaseFactId, rebaseProposal, validateApproval } from "@/lib/engine/apply";
import { dedupe } from "@/lib/engine/dedupe";
import { nextDocumentId } from "@/lib/extraction/documentMeta";
import { rejectForeignOrigin } from "@/lib/http/originGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign;

  let body: { proposalId?: unknown; approvedFactIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  if (typeof body.proposalId !== "string") return NextResponse.json({ ok: false, reason: "missing proposal" }, { status: 400 });
  const proposalId = body.proposalId;

  try {
    return await withStateLock(async () => {
      const proposal = await loadProposal(proposalId);
      if (!proposal) return NextResponse.json({ ok: false, reason: "proposal not found" }, { status: 404 });

      const check = validateApproval(proposal, body.approvedFactIds);
      if (!check.ok) return NextResponse.json({ ok: false, reason: check.reason }, { status: 400 });

      const state = await readState();
      // Guard: the record may have changed since extraction — never write a duplicate fact.
      const { fresh } = dedupe(state.facts, check.approved);
      if (fresh.length === 0) {
        await deleteProposal(proposal.proposalId);
        return NextResponse.json({ ok: true, status: "no_changes" });
      }

      const documentId = nextDocumentId(state);
      const final = rebaseProposal(proposal, documentId);
      const approvedIds = fresh.map((f) => rebaseFactId(f.id, proposal.document.id, documentId));
      // Fail closed if final identity would collide with anything already approved (it cannot, by construction).
      const taken =
        state.documents.some((d) => d.id === documentId || d.file === final.document.file) ||
        final.facts.some((f) => state.facts.some((s) => s.id === f.id));
      if (taken) return NextResponse.json({ ok: false, reason: "identity conflict" }, { status: 409 });

      const next = apply(state, final, approvedIds, new Date().toISOString());
      await commitProposalDocument(final);
      await writeState(next);
      await deleteProposal(proposal.proposalId);
      return NextResponse.json({ ok: true, status: "applied" });
    });
  } catch (err) {
    if (err instanceof StateBusyError) return NextResponse.json({ ok: false, reason: "busy" }, { status: 503 });
    throw err;
  }
}
