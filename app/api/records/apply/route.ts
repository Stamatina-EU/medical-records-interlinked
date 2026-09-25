/**
 * Apply Route — POST { proposalId, approvedFactIds }. Spec: `spec.md > Apply Route`.
 * The browser sends ONLY ids. The server reloads its own copy of the proposal and never trusts
 * fact contents from the browser. No approved facts → no Apply → nothing is persisted.
 */
import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/store/stateStore";
import { commitProposalDocument, deleteProposal, loadProposal } from "@/lib/store/proposalStore";
import { apply, validateApproval } from "@/lib/engine/apply";
import { dedupe } from "@/lib/engine/dedupe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { proposalId?: unknown; approvedFactIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  if (typeof body.proposalId !== "string") return NextResponse.json({ ok: false, reason: "missing proposal" }, { status: 400 });

  const proposal = await loadProposal(body.proposalId);
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

  const next = apply(state, proposal, fresh.map((f) => f.id), new Date().toISOString());
  await commitProposalDocument(proposal);
  await writeState(next);
  await deleteProposal(proposal.proposalId);
  return NextResponse.json({ ok: true, status: "applied" });
}
