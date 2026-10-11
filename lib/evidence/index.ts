/**
 * Evidence index — a serializable bundle the server passes to the client so the Evidence
 * Drawer can open any fact or calculated claim with no network call.
 * Spec: `spec.md > Evidence Drawer`.
 */
import type { CalculatedClaim, DocumentRecord, TrustedState } from "@/lib/model/types";
import type { RecordSourceFact, RichSyntheticState } from "@/lib/model/rich";
import { analyteLabel } from "@/lib/rich/catalog";
import { formatDate } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";

export type EvidenceIndex = {
  facts: Record<string, RecordSourceFact>;
  documentUrlBase?: string;
  routeBase?: string;
  profile?: "rich-synthetic";
  documents: Record<string, DocumentRecord>;
  claims: Record<string, CalculatedClaim>;
  episodes: Record<string, string>;
};

export function buildEvidenceIndex(state: Pick<TrustedState | RichSyntheticState, "facts" | "documents" | "episodes">, claims: CalculatedClaim[]): EvidenceIndex {
  return {
    facts: Object.fromEntries(state.facts.map((f) => [f.id, f])),
    documents: Object.fromEntries(state.documents.map((d) => [d.id, d])),
    claims: Object.fromEntries(claims.map((c) => [c.key, c])),
    episodes: Object.fromEntries(state.episodes.map((e) => [e.id, e.name])),
  };
}

export type EvidenceRef = { type: "fact"; id: string } | { type: "claim"; key: string };

/** "Laboratory Report · 27 Jan 2026" */
export function documentShortLabel(doc: DocumentRecord): string {
  return `${doc.title} · ${formatDate(doc.date)}`;
}

/** A plain-language headline for a source fact (used in the drawer and in lists). */
export function factHeadline(fact: RecordSourceFact, episodes: Record<string, string>): { label: string; value: string } {
  switch (fact.kind) {
    case "lab_measurement":
      return { label: analyteLabel(fact.analyte), value: `${fact.value} ${fact.unit}` };
    case "documented_incident":
      return { label: "Documented incident", value: fact.statement };
    case "medication_status":
      return {
        label: episodes[fact.episodeId] ?? "Medication",
        value: `${statusLabel(fact.status)} · documented ${formatDate(fact.documentedOn)}`,
      };
    case "follow_up":
      return { label: "Documented follow-up", value: fact.recommendation };
    case "imaging_exam":
      return { label: fact.examName, value: formatDate(fact.performedOn) };
  }
}
