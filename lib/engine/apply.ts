/**
 * Engine: preview and apply an approved subset of a proposal. Pure.
 * Spec: `spec.md > Engine` (`preview`, `apply`); PRD: `prd.md > Deterministic State Update`.
 *
 * Patients approve evidence (source facts); code derives consequences. Only APPROVED facts are
 * ever written; rejected facts are simply not included. An approved extracted fact stays a
 * SOURCE FACT — approval changes only its review status.
 */
import type { ChangeLine, Proposal, SourceFact, TrustedState } from "@/lib/model/types";
import { affectedKeys, describeChanges } from "@/lib/engine/changes";
import { MEDICATION_EPISODES } from "@/lib/extraction/lexicon";

export type ApprovalCheck = { ok: true; approved: Proposal["facts"] } | { ok: false; reason: string };

/** Validate the browser's approval: known, unique proposal fact ids only — never fact contents. */
export function validateApproval(proposal: Proposal, approvedFactIds: unknown): ApprovalCheck {
  if (!Array.isArray(approvedFactIds) || approvedFactIds.some((id) => typeof id !== "string")) {
    return { ok: false, reason: "approvedFactIds must be a list of ids" };
  }
  const ids = approvedFactIds as string[];
  if (ids.length === 0) return { ok: false, reason: "no facts approved — nothing to apply" };
  if (new Set(ids).size !== ids.length) return { ok: false, reason: "duplicate fact ids" };
  const known = new Map(proposal.facts.map((f) => [f.id, f]));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) return { ok: false, reason: `unknown fact ids: ${unknown.join(", ")}` };
  return { ok: true, approved: ids.map((id) => known.get(id)!) };
}

/** A proposal fact id, moved from the proposal's provisional document id to its final one. */
export function rebaseFactId(id: string, fromDocumentId: string, toDocumentId: string): string {
  return id.startsWith(`${fromDocumentId}-`) ? `${toDocumentId}${id.slice(fromDocumentId.length)}` : id;
}

/**
 * Give a proposal its final identity. The document id assigned at extraction is provisional: another proposal made
 * from the same trusted state may have received the same one. At approval the route assigns the next free id from
 * the CURRENT state (under the state lock) and rebases the document, its PDF file name, every fact id and every
 * source reference consistently. Fact contents are untouched.
 */
export function rebaseProposal(proposal: Proposal, documentId: string): Proposal {
  const from = proposal.document.id;
  if (from === documentId) return proposal;
  return {
    ...proposal,
    document: { ...proposal.document, id: documentId, file: `${documentId}.pdf` },
    facts: proposal.facts.map((f) => ({
      ...f,
      id: rebaseFactId(f.id, from, documentId),
      source: { ...f.source, documentId },
    })),
  };
}

function withFacts(state: TrustedState, proposal: Proposal, approvedIds: string[]): TrustedState {
  const approved = new Set(approvedIds);
  const facts: SourceFact[] = proposal.facts
    .filter((f) => approved.has(f.id))
    .map((f) => ({ ...f, review: "APPROVED" }) as SourceFact);
  if (facts.length === 0) return state;
  // The first approved status of a supported medication creates its episode (empty-history bootstrap).
  const newEpisodes = MEDICATION_EPISODES.filter(
    (ep) => !state.episodes.some((e) => e.id === ep.id) && facts.some((f) => f.kind === "medication_status" && f.episodeId === ep.id),
  );
  return {
    ...state,
    documents: [...state.documents, proposal.document],
    episodes: [...state.episodes, ...newEpisodes],
    facts: [...state.facts, ...facts],
  };
}

/** "This would also update…" — recomputed live as the patient rejects facts. */
export function preview(state: TrustedState, proposal: Proposal, approvedIds: string[]): ChangeLine[] {
  return describeChanges(state, withFacts(state, proposal, approvedIds));
}

/** Write the approved subset into the trusted state and mark it as the latest update. */
export function apply(state: TrustedState, proposal: Proposal, approvedIds: string[], approvedAt: string): TrustedState {
  const next = withFacts(state, proposal, approvedIds);
  if (next === state) return state;
  return {
    ...next,
    latestUpdate: {
      documentId: proposal.document.id,
      approvedFactIds: [...approvedIds],
      affected: affectedKeys(state, next),
      approvedAt,
    },
  };
}
