/**
 * Extract Route — POST multipart/form-data { file: PDF }. Spec: `spec.md > Extract Route`.
 *
 * PDF text (code) → proposed facts (AI) → per-fact verification (code) → dedupe (code) →
 * pending proposal. The trusted state is NEVER touched here.
 * Responses: { status: "proposal" | "no_changes" | "unusable" } (200) or { status: "unavailable" } (502).
 */
import { NextResponse } from "next/server";
import { readState } from "@/lib/store/stateStore";
import { readPdfPages, hasText } from "@/lib/extraction/pdfText";
import { extractFacts, ExtractionUnavailableError } from "@/lib/extraction/extract";
import { verifyExtraction } from "@/lib/extraction/verify";
import { dedupe } from "@/lib/engine/dedupe";
import { addedDocumentRecord, nextDocumentId } from "@/lib/extraction/documentMeta";
import { clearPending, newProposalId, saveProposal } from "@/lib/store/proposalStore";
import type { Proposal } from "@/lib/model/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

const unusable = (reason: string) => {
  // server log: the reason only — never document text
  console.info(`[extract] unusable: ${reason}`);
  return NextResponse.json({ status: "unusable" });
};

export async function POST(req: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ status: "unusable" }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ status: "unusable" }, { status: 400 });
  if (file.size > MAX_BYTES) return unusable("file too large");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return unusable("not a PDF");

  await clearPending(); // orphaned proposals (e.g. after a refresh mid-review) are discarded

  let pages: string[];
  try {
    pages = await readPdfPages(bytes);
  } catch {
    return unusable("PDF could not be read");
  }
  if (!hasText(pages)) return unusable("no text layer");

  const state = await readState();

  let call;
  try {
    call = await extractFacts(pages);
  } catch (err) {
    if (err instanceof ExtractionUnavailableError) {
      console.warn(`[extract] AI unavailable: ${err.message}`);
      return NextResponse.json({ status: "unavailable" }, { status: 502 });
    }
    throw err;
  }
  if (call.status === "unusable") return unusable(call.reason);

  const documentId = nextDocumentId(state);
  const outcome = verifyExtraction(pages, call.extraction, { documentId, episodes: state.episodes });
  if (outcome.status === "unusable") return unusable(outcome.reason);

  const { fresh } = dedupe(state.facts, outcome.verified);
  if (fresh.length === 0) return NextResponse.json({ status: "no_changes" });

  const proposal: Proposal = {
    proposalId: newProposalId(),
    document: addedDocumentRecord(pages, call.extraction.document.documentType, outcome.documentDate, documentId),
    facts: fresh,
    excludedCount: outcome.excludedCount,
    createdAt: new Date().toISOString(),
  };
  await saveProposal(proposal, bytes);
  console.info(`[extract] proposal ${proposal.proposalId}: ${fresh.length} verified, ${outcome.excludedCount} left out (${call.model})`);

  // The current trusted state goes back so the browser can rerun the pure preview as facts are rejected.
  return NextResponse.json({ status: "proposal", proposal, state });
}
