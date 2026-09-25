/**
 * Engine: derive — CALCULATED claims from approved source facts. Pure; never persisted.
 * Spec: `spec.md > Engine` (`derive`, medication status).
 *
 * Code may calculate chronology; it never turns chronology into medical judgement.
 * Every claim lists the source facts it was computed from (`inputFactIds`).
 */
import type {
  CalculatedClaim,
  FollowUp,
  LabMeasurement,
  MedicationStatusEvent,
  TrustedState,
} from "@/lib/model/types";

export function ferritinSeries(state: TrustedState): LabMeasurement[] {
  return state.facts
    .filter((f): f is LabMeasurement => f.kind === "lab_measurement" && f.analyte === "ferritin")
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
}

export function isOutsideSuppliedRange(m: LabMeasurement): boolean | null {
  if (m.refLow === null || m.refHigh === null) return null;
  return m.value < m.refLow || m.value > m.refHigh;
}

/** The latest EXPLICIT status event for an episode (by documentation date; later entry wins ties). */
export function latestMedicationStatus(state: TrustedState, episodeId: string): MedicationStatusEvent | null {
  let latest: MedicationStatusEvent | null = null;
  for (const f of state.facts) {
    if (f.kind !== "medication_status" || f.episodeId !== episodeId) continue;
    if (!latest || f.documentedOn >= latest.documentedOn) latest = f;
  }
  return latest;
}

export function medicationEvents(state: TrustedState, episodeId: string): MedicationStatusEvent[] {
  return state.facts
    .filter((f): f is MedicationStatusEvent => f.kind === "medication_status" && f.episodeId === episodeId)
    .sort((a, b) => a.documentedOn.localeCompare(b.documentedOn));
}

export function followUps(state: TrustedState, topic: "iron" | "imaging"): FollowUp[] {
  return state.facts
    .filter((f): f is FollowUp => f.kind === "follow_up" && f.topic === topic)
    .sort((a, b) => a.recommendedOn.localeCompare(b.recommendedOn));
}

export function derive(state: TrustedState): CalculatedClaim[] {
  const claims: CalculatedClaim[] = [];
  const series = ferritinSeries(state);

  // Inside / outside the range supplied WITH that result
  for (const m of series) {
    const outside = isOutsideSuppliedRange(m);
    if (outside === null) continue;
    claims.push({
      key: `range:${m.id}`,
      kind: "range_status",
      text: outside ? "Outside supplied laboratory range" : "Inside supplied laboratory range",
      ruleDescription: `The value is compared with the reference range printed with this result (${m.refText} ${m.unit}). Ranges differ between laboratories, so each result is compared only with its own.`,
      inputFactIds: [m.id],
    });
  }

  // Previously outside supplied range — for each result, any EARLIER result outside its own range
  series.forEach((m, i) => {
    const earlierOutside = series.slice(0, i).filter((e) => isOutsideSuppliedRange(e) === true);
    if (earlierOutside.length === 0) return;
    claims.push({
      key: `prev-outside:${m.id}`,
      kind: "previously_outside_range",
      text: "Previously outside supplied range",
      ruleDescription: "An earlier ferritin result in this history was outside the reference range supplied with that earlier result.",
      inputFactIds: earlierOutside.map((e) => e.id),
    });
  });

  // Changed since previous measurement — latest vs the one before it
  if (series.length >= 2) {
    const latest = series[series.length - 1];
    const previous = series[series.length - 2];
    if (Math.abs(latest.value - previous.value) > 1e-9) {
      claims.push({
        key: `change:${latest.id}`,
        kind: "changed_since_previous",
        text: "Changed since previous measurement",
        ruleDescription: "The latest ferritin value differs from the previous ferritin value in this history.",
        inputFactIds: [previous.id, latest.id],
      });
    }
  }

  // Matching follow-up result found — chronology only, no judgement of timing
  for (const fu of followUps(state, "iron")) {
    if (!("analyte" in fu.target) || fu.target.analyte !== "ferritin") continue;
    const match = series.find((m) => m.measuredOn > fu.recommendedOn);
    if (!match) continue;
    claims.push({
      key: `followup-match:${fu.id}`,
      kind: "followup_match",
      text: "Matching follow-up result found",
      ruleDescription:
        "An earlier record documented a recommendation to repeat ferritin, and a later approved ferritin result exists. This states chronology only — not whether the follow-up was on time.",
      inputFactIds: [fu.id, match.id],
    });
  }

  return claims;
}
