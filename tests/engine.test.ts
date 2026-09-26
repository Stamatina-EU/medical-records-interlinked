/** Engine derivations on the real seed state (and a seed + live-note fixture). `spec.md > Engine`. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LabMeasurement, MedicationStatusEvent, TrustedState } from "@/lib/model/types";
import { derive, latestMedicationStatus } from "@/lib/engine/derive";
import { snapshotView } from "@/lib/view/snapshot";

const seed: TrustedState = JSON.parse(readFileSync(path.resolve(__dirname, "../data/seed/state.json"), "utf8"));
const keys = (s: TrustedState) => derive(s).map((c) => c.key);

/** The two facts the live note contributes, as they would be after approval. */
function withLiveUpdate(state: TrustedState): TrustedState {
  const lab: LabMeasurement = {
    id: "doc-07-lab-1",
    kind: "lab_measurement",
    topic: "iron",
    analyte: "ferritin",
    value: 32,
    unit: "μg/L",
    refLow: 15,
    refHigh: 150,
    refText: "15–150",
    measuredOn: "2026-09-25",
    source: { documentId: "doc-07", page: 2, verifiedExcerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." },
    review: "APPROVED",
  };
  const med: MedicationStatusEvent = {
    id: "doc-07-med-1",
    kind: "medication_status",
    episodeId: "ep-oral-iron",
    status: "Current",
    documentedOn: "2026-09-25",
    source: {
      documentId: "doc-07",
      page: 1,
      verifiedExcerpt: "The patient continues to take oral iron (ferrous sulfate) once daily.",
    },
    review: "APPROVED",
  };
  return { ...state, facts: [...state.facts, lab, med] };
}

describe("derive — pre-update seed state", () => {
  const claims = derive(seed);
  const byKey = Object.fromEntries(claims.map((c) => [c.key, c]));

  it("compares each result only with the range supplied with it", () => {
    expect(byKey["range:lab-ferritin-2025-03-14"].text).toBe("Outside supplied laboratory range"); // 11 vs 30–400
    expect(byKey["range:lab-ferritin-2026-01-27"].text).toBe("Inside supplied laboratory range"); // 19.6 vs 15–150
  });

  it("marks the later result as previously outside supplied range, citing the earlier result", () => {
    expect(byKey["prev-outside:lab-ferritin-2026-01-27"].inputFactIds).toEqual(["lab-ferritin-2025-03-14"]);
    expect(byKey["prev-outside:lab-ferritin-2025-03-14"]).toBeUndefined();
  });

  it("notes a change since the previous measurement, citing both inputs", () => {
    expect(byKey["change:lab-ferritin-2026-01-27"].inputFactIds).toEqual(["lab-ferritin-2025-03-14", "lab-ferritin-2026-01-27"]);
  });

  it("finds no matching follow-up result yet, and states that chronology about the record", () => {
    expect(keys(seed).some((k) => k.startsWith("followup-match:"))).toBe(false);
    expect(byKey["followup-no-later:fu-ferritin-2026-02-03"]).toMatchObject({
      text: "No later ferritin result found in your record",
      inputFactIds: ["fu-ferritin-2026-02-03"],
    });
  });

  it("shows the medication as Prescribed from the explicit prescription only", () => {
    expect(latestMedicationStatus(seed, "ep-oral-iron")?.status).toBe("Prescribed");
  });

  it("never uses judgement words", () => {
    const text = claims.map((c) => `${c.text} ${c.ruleDescription}`).join(" ").toLowerCase();
    for (const word of ["good", "bad", "dangerous", "healthy", "normal", "abnormal", "low", "high", "overdue", "late", "on time", "satisfied"]) {
      expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });
});

describe("derive — after the live note's two facts are approved", () => {
  const after = withLiveUpdate(seed);
  const byKey = Object.fromEntries(derive(after).map((c) => [c.key, c]));

  it("finds the matching follow-up result from the recommendation and the later result", () => {
    expect(byKey["followup-match:fu-ferritin-2026-02-03"].inputFactIds).toEqual(["fu-ferritin-2026-02-03", "doc-07-lab-1"]);
    expect(byKey["followup-match:fu-ferritin-2026-02-03"].text).toBe("Matching follow-up result found · 25 Sep 2026");
    // the "no later result" state is replaced, never shown alongside the match
    expect(byKey["followup-no-later:fu-ferritin-2026-02-03"]).toBeUndefined();
  });

  it("moves the medication to Current (Ongoing) and the latest ferritin to 32", () => {
    expect(latestMedicationStatus(after, "ep-oral-iron")?.status).toBe("Current");
    const view = snapshotView(after, derive(after));
    const g = Object.fromEntries(view.latestGroups.map((x) => [x.kind, x]));
    expect(g.measurements.kind === "measurements" && [g.measurements.count, g.measurements.latestFactId]).toEqual([3, "doc-07-lab-1"]);
    expect(g.treatment.kind === "treatment" && g.treatment.latestEventId).toBe("doc-07-med-1");
    expect(view.followUpsOnRecord.find((f) => f.factId === "fu-ferritin-2026-02-03")?.stateKey).toBe(
      "followup-match:fu-ferritin-2026-02-03",
    );
  });

  it("without the ferritin fact there is no follow-up match (consequences depend on evidence)", () => {
    const medOnly = { ...after, facts: after.facts.filter((f) => f.id !== "doc-07-lab-1") };
    expect(keys(medOnly).some((k) => k.startsWith("followup-match:"))).toBe(false);
  });
});

describe("home view — summary-first, scalable, evidence-only", () => {
  const view = snapshotView(seed, derive(seed));

  it("summarises what the record contains (evidence coverage) with deterministic counts only", () => {
    expect(view.summary).toEqual({
      documentCount: 6,
      documentTypes: [
        { label: "imaging reports", count: 2 },
        { label: "lab reports", count: 2 },
        { label: "consultation note", count: 1 },
        { label: "prescription", count: 1 },
      ],
      firstDocumentDate: "2025-03-14",
      lastDocumentDate: "2026-03-12",
    });
  });

  it("groups 'Latest in your record' by category — one group each, never one card per value", () => {
    expect(view.latestGroups.map((g) => [g.kind, g.count, g.countLabel])).toEqual([
      ["measurements", 2, "2 ferritin results"],
      ["treatment", 1, "1 treatment documented"],
      ["imaging", 2, "2 thyroid ultrasounds"],
    ]);
    const g = Object.fromEntries(view.latestGroups.map((x) => [x.kind, x]));
    expect(g.measurements.kind === "measurements" && g.measurements.latestFactId).toBe("lab-ferritin-2026-01-27");
    expect(g.treatment.kind === "treatment" && g.treatment.latestEventId).toBe("med-oral-iron-2026-02-03-prescribed");
    expect(g.imaging.kind === "imaging" && g.imaging.latestExamId).toBe("img-thyroid-2026-03-12");
  });

  it("'Follow-up on record' lists the latest recommendation per topic with its record chronology", () => {
    expect(view.followUpsOnRecord).toEqual([
      { factId: "fu-ferritin-2026-02-03", stateKey: "followup-no-later:fu-ferritin-2026-02-03", updated: false },
      { factId: "fu-imaging-2026-03-12", stateKey: null, updated: false },
    ]);
  });

  it("'Your history' summarises topics with factual counts and date spans only", () => {
    expect(view.history.map((h) => [h.topic, h.count, h.firstDate, h.lastDate])).toEqual([
      ["iron", 2, "2025-03-14", "2026-01-27"],
      ["imaging", 2, "2025-09-10", "2026-03-12"],
    ]);
  });
});
