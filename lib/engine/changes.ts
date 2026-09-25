/**
 * Engine: describe what changed between two trusted states. Pure.
 * Spec: `spec.md > Engine` (`preview`, `changesSummary`).
 *
 * Used both BEFORE approval ("This would also update…", from a hypothetical state) and AFTER
 * ("What changed", from the saved state). Every line points at a source fact or a derived claim,
 * so it can open the evidence drawer. Chronology only — no judgement words.
 */
import type { ChangeLine, LabMeasurement, TrustedState } from "@/lib/model/types";
import { derive, latestMedicationStatus } from "@/lib/engine/derive";
import { formatDate } from "@/lib/text/dates";

export function describeChanges(before: TrustedState, after: TrustedState): ChangeLine[] {
  const lines: ChangeLine[] = [];
  const beforeIds = new Set(before.facts.map((f) => f.id));

  // New measurements
  for (const f of after.facts) {
    if (beforeIds.has(f.id) || f.kind !== "lab_measurement") continue;
    const m = f as LabMeasurement;
    lines.push({
      text: `New ferritin measurement added · ${m.value} ${m.unit} · ${formatDate(m.measuredOn)}`,
      ref: { type: "fact", id: m.id },
    });
  }

  // Follow-up chronology that newly appears
  const beforeClaims = new Map(derive(before).map((c) => [c.key, c]));
  for (const c of derive(after)) {
    if (c.kind === "followup_match" && !beforeClaims.has(c.key)) {
      lines.push({ text: c.text, ref: { type: "claim", key: c.key } });
    }
  }

  // Medication status changes — only from explicit, documented status events
  for (const ep of after.episodes) {
    const was = latestMedicationStatus(before, ep.id);
    const now = latestMedicationStatus(after, ep.id);
    if (!now || now.id === was?.id) continue;
    const name = ep.name.split(" (")[0];
    lines.push({
      text: `${name} marked ${now.status} · documented ${formatDate(now.documentedOn)}`,
      ref: { type: "fact", id: now.id },
    });
  }
  return lines;
}

/** Fact ids and derived-claim keys that are new or changed between two states. */
export function affectedKeys(before: TrustedState, after: TrustedState): string[] {
  const beforeIds = new Set(before.facts.map((f) => f.id));
  const newFacts = after.facts.filter((f) => !beforeIds.has(f.id)).map((f) => f.id);
  const beforeClaims = new Map(derive(before).map((c) => [c.key, c.text]));
  const changedClaims = derive(after)
    .filter((c) => beforeClaims.get(c.key) !== c.text)
    .map((c) => c.key);
  return [...newFacts, ...changedClaims];
}

/** "What changed" for the saved state: compare with the state before the latest update. */
export function changesSummary(state: TrustedState): ChangeLine[] {
  if (!state.latestUpdate) return [];
  const added = new Set(state.latestUpdate.approvedFactIds);
  const before: TrustedState = {
    ...state,
    documents: state.documents.filter((d) => d.id !== state.latestUpdate!.documentId),
    facts: state.facts.filter((f) => !added.has(f.id)),
    latestUpdate: null,
  };
  return describeChanges(before, state);
}
