/**
 * Extraction pipeline — the outcome of one Add record attempt, decided ONLY from what each
 * pipeline step actually returned. Spec: `spec.md > Extract Route`.
 *
 *   file check → PDF text (code) → proposed facts (AI) → per-fact verification (code) → dedupe (code)
 *
 * Every non-proposal outcome carries a fixed reason code and NEVER any document text, model
 * output or extracted value, so it is safe to log and to send to the browser.
 * No side effects: the route saves the proposal; the trusted state is never touched.
 */
import type { Proposal, TrustedState } from "@/lib/model/types";
import { readPdfPages, hasText } from "@/lib/extraction/pdfText";
import { ExtractionUnavailableError, type ExtractionCallResult } from "@/lib/extraction/extract";
import { verifyExtraction } from "@/lib/extraction/verify";
import { dedupe } from "@/lib/engine/dedupe";
import { addedDocumentRecord, nextDocumentId } from "@/lib/extraction/documentMeta";

export const MAX_BYTES = 10 * 1024 * 1024;

export type PipelineOutcome =
  | { status: "proposal"; proposal: Proposal; model: string }
  /** valid extraction, but every verified fact is already in the history */
  | { status: "no_changes" }
  /** not something this prototype can open as a PDF */
  | { status: "unsupported_file"; code: "not_pdf" | "too_large" | "damaged_pdf" }
  /** a PDF with no usable text layer (e.g. a scan) — the AI is never called */
  | { status: "no_text" }
  /** text was read, but the model proposed no fact of a supported type */
  | { status: "no_supported_facts"; code: "no_candidate_facts" }
  /** supported fact(s) were proposed, but every one failed deterministic verification
      (including when the document date itself can't be verified, so no fact can be dated) */
  | { status: "no_verified_facts"; code: "document_date_unverified" | "none_verified" }
  /** the AI call or its structured output failed */
  | { status: "processing_failed"; code: "ai_unavailable" | "ai_refused" | "ai_incomplete" | "ai_invalid_output"; retryable: boolean };

export type PipelineDeps = {
  extract: (pages: string[]) => Promise<ExtractionCallResult>;
  newProposalId: () => string;
  now: () => string;
};

export async function runExtractionPipeline(bytes: Uint8Array, state: TrustedState, deps: PipelineDeps): Promise<PipelineOutcome> {
  if (bytes.length > MAX_BYTES) return { status: "unsupported_file", code: "too_large" };
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return { status: "unsupported_file", code: "not_pdf" };

  let pages: string[];
  try {
    pages = await readPdfPages(bytes);
  } catch {
    return { status: "unsupported_file", code: "damaged_pdf" };
  }
  if (!hasText(pages)) return { status: "no_text" };

  let call: ExtractionCallResult;
  try {
    call = await deps.extract(pages);
  } catch (err) {
    if (err instanceof ExtractionUnavailableError) return { status: "processing_failed", code: "ai_unavailable", retryable: true };
    throw err;
  }
  if (call.status === "unusable") {
    const code = call.code === "refused" ? "ai_refused" : call.code === "incomplete" ? "ai_incomplete" : "ai_invalid_output";
    // a refusal is likely to repeat; an incomplete or malformed answer may not
    return { status: "processing_failed", code, retryable: call.code !== "refused" };
  }

  const documentId = nextDocumentId(state);
  const outcome = verifyExtraction(pages, call.extraction, { documentId, episodes: state.episodes });
  if (outcome.status === "unusable") {
    return outcome.code === "no_candidate_facts"
      ? { status: "no_supported_facts", code: outcome.code }
      : { status: "no_verified_facts", code: outcome.code };
  }

  const { fresh } = dedupe(state.facts, outcome.verified);
  if (fresh.length === 0) return { status: "no_changes" };

  return {
    status: "proposal",
    model: call.model,
    proposal: {
      proposalId: deps.newProposalId(),
      document: addedDocumentRecord(pages, call.extraction.document.documentType, outcome.documentDate, documentId),
      facts: fresh,
      excludedCount: outcome.excludedCount,
      createdAt: deps.now(),
    },
  };
}

/** One content-free log line: status and reason code only. */
export function outcomeLogLine(o: PipelineOutcome): string {
  switch (o.status) {
    case "proposal":
      return `[extract] proposal ${o.proposal.proposalId}: ${o.proposal.facts.length} verified, ${o.proposal.excludedCount} left out (${o.model})`;
    case "no_changes":
    case "no_text":
      return `[extract] ${o.status}`;
    default:
      return `[extract] ${o.status}: ${o.code}`;
  }
}
