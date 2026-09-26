/** History view model — `spec.md > History Page (Topic Template)`. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Proposal, TrustedState } from "@/lib/model/types";
import { derive } from "@/lib/engine/derive";
import { apply } from "@/lib/engine/apply";
import { historyView } from "@/lib/view/history";

const seed: TrustedState = JSON.parse(readFileSync(path.resolve(__dirname, "../data/seed/state.json"), "utf8"));

const proposal: Proposal = {
  proposalId: "00000000-0000-4000-8000-000000000000",
  document: { id: "doc-07", title: "Follow-up Consultation Note", documentType: "consultation_note", issuer: "", date: "2026-09-25", file: "doc-07.pdf", pageCount: 2, origin: "added" },
  excludedCount: 0,
  createdAt: "2026-09-26T10:00:00.000Z",
  facts: [
    { id: "doc-07-lab-1", kind: "lab_measurement", topic: "iron", analyte: "ferritin", value: 32, unit: "μg/L", refLow: 15, refHigh: 150, refText: "15–150", measuredOn: "2026-09-25", source: { documentId: "doc-07", page: 2, verifiedExcerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }, review: "PROPOSED" },
    { id: "doc-07-med-1", kind: "medication_status", episodeId: "ep-oral-iron", status: "Current", documentedOn: "2026-09-25", source: { documentId: "doc-07", page: 1, verifiedExcerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }, review: "PROPOSED" },
  ],
};
const after = apply(seed, proposal, ["doc-07-lab-1", "doc-07-med-1"], "2026-09-26T10:05:00.000Z");
const view = (s: TrustedState, t: "iron" | "imaging") => historyView(s, derive(s), t);

describe("History › Iron / Ferritin", () => {
  it("seed: 2 results newest first, each with its OWN supplied range and derived labels", () => {
    const v = view(seed, "iron");
    if (v.topic !== "iron") throw new Error("wrong topic");
    expect(v.measurements.map((m) => [m.fact.measuredOn, m.fact.value, m.fact.refText])).toEqual([
      ["2026-01-27", 19.6, "15–150"],
      ["2025-03-14", 11, "30–400"],
    ]);
    expect(v.measurements[0].claimKeys).toEqual(["range:lab-ferritin-2026-01-27", "change:lab-ferritin-2026-01-27", "prev-outside:lab-ferritin-2026-01-27"]);
    expect(v.series.map((m) => m.measuredOn)).toEqual(["2025-03-14", "2026-01-27"]); // chart: oldest first
    expect(v.treatment[0].events.map((e) => e.fact.status)).toEqual(["Prescribed"]);
    expect(v.followUps[0]).toMatchObject({ stateKey: "followup-no-later:fu-ferritin-2026-02-03", elapsedMonths: null });
  });

  it("after the update: 3 results, the new one marked; Prescribed → Current (Ongoing); follow-up matched with plain chronology", () => {
    const v = view(after, "iron");
    if (v.topic !== "iron") throw new Error("wrong topic");
    expect(v.measurements.map((m) => [m.fact.value, m.updated])).toEqual([
      [32, true],
      [19.6, false],
      [11, false],
    ]);
    expect(v.treatment[0].events.map((e) => [e.fact.status, e.updated])).toEqual([
      ["Prescribed", false],
      ["Current", true],
    ]);
    expect(v.followUps[0]).toMatchObject({ stateKey: "followup-match:fu-ferritin-2026-02-03", elapsedMonths: 7, updated: true });
  });
});

describe("History › Imaging follow-up", () => {
  it("no chart data; examinations in chronological order; the comparison only where the report states it", () => {
    const v = view(seed, "imaging");
    if (v.topic !== "imaging") throw new Error("wrong topic");
    expect("series" in v).toBe(false);
    expect(v.exams.map((x) => [x.fact.performedOn, x.comparesToDate])).toEqual([
      ["2025-09-10", null],
      ["2026-03-12", "2025-09-10"],
    ]);
    expect(v.followUps.map((f) => [f.fact.recommendedOn, f.stateKey])).toEqual([
      ["2026-03-12", null],
      ["2025-09-10", null],
    ]);
  });
});
