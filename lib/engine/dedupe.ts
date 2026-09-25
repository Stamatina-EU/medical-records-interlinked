/**
 * Engine: dedupe — drop verified facts that already exist in the approved state.
 * Spec: `spec.md > Engine` (`dedupe`). Pure.
 *  - lab: same analyte + date + value + unit
 *  - medication: same episode + status + documented date
 */
import type { ProposedFact, SourceFact } from "@/lib/model/types";
import { normalize } from "@/lib/text/normalize";

function sameFact(a: ProposedFact, b: SourceFact): boolean {
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
  for (const p of proposed) (approved.some((f) => sameFact(p, f)) ? duplicates : fresh).push(p);
  return { fresh, duplicates };
}
