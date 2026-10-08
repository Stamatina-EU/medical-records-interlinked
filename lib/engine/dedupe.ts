/**
 * Engine: dedupe — drop verified facts that already exist in the approved state, or that repeat an earlier
 * candidate of the same proposal (the AI may list one fact twice). Spec: `spec.md > Engine` (`dedupe`). Pure.
 *  - lab: same analyte + date + value + unit
 *  - medication: same episode + status + documented date
 */
import type { ProposedFact, SourceFact } from "@/lib/model/types";
import { normalize } from "@/lib/text/normalize";

function sameFact(a: ProposedFact | SourceFact, b: ProposedFact | SourceFact): boolean {
  if (a.kind === "lab_measurement" && b.kind === "lab_measurement") {
    return (
      a.analyte === b.analyte &&
      a.measuredOn === b.measuredOn &&
      Math.abs(a.value - b.value) < 1e-9 &&
      normalize(a.unit) === normalize(b.unit)
    );
  }
  if (a.kind === "medication_status" && b.kind === "medication_status") {
    return a.episodeId === b.episodeId && a.status === b.status && a.documentedOn === b.documentedOn;
  }
  return false;
}

export function dedupe(
  approved: SourceFact[],
  proposed: ProposedFact[],
): { fresh: ProposedFact[]; duplicates: ProposedFact[] } {
  const fresh: ProposedFact[] = [];
  const duplicates: ProposedFact[] = [];
  for (const p of proposed) {
    const repeat = approved.some((f) => sameFact(p, f)) || fresh.some((f) => sameFact(p, f));
    (repeat ? duplicates : fresh).push(p);
  }
  return { fresh, duplicates };
}
