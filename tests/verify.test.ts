/**
 * Verifier Tests — `spec.md > Verifier Tests`.
 * Fixture page text mirrors what unpdf extracts from the synthetic corpus.
 */
import { describe, expect, it } from "vitest";
import {
  locateExcerpt,
  verifyExtraction,
  verifyLabFact,
  verifyMedicationFact,
  type Extraction,
} from "@/lib/extraction/verify";
import type { MedicationEpisode } from "@/lib/model/types";

const episodes: MedicationEpisode[] = [{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }];

// The live follow-up note, as extracted (page 1, page 2).
const livePages = [
  "Elm Street Primary Care\nGeneral practice (fictional) FOLLOW-UP CONSULTATION NOTE\nPatient Laurence Mercer (fictional)\nDate of consultation 25 Sep 2026\nType Follow-up consultation\nREASON FOR VISIT\nFollow-up of iron studies.\nMEDICATION HISTORY\nThe patient continues to take oral iron (ferrous sulfate) once daily.\nNo other regular medication is recorded at this visit.",
  "Elm Street Primary Care\nLaurence Mercer (fictional) · 25 Sep 2026 FOLLOW-UP CONSULTATION NOTE\nRESULTS\nFerritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).\nPLAN\nResults discussed with the patient.\nNote: “continue routine care”.",
];

const goodExtraction: Extraction = {
  document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
  labMeasurements: [
    {
      analyteName: "Ferritin",
      value: 32,
      unit: "μg/L",
      referenceRangeText: "15–150 μg/L",
      measuredOn: "2026-09-25",
      page: 2,
      excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).",
    },
  ],
  medicationStatements: [
    {
      medicationName: "oral iron (ferrous sulfate)",
      status: "current",
      page: 1,
      excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily.",
    },
  ],
};

describe("canonical verifiedExcerpt (the trust promise)", () => {
  it("matches after allowed normalization but returns the SOURCE wording, not the model's", () => {
    // micro sign instead of Greek mu, hyphen instead of en dash, doubled space, lowercase
    const modelExcerpt = "ferritin on 25 sep 2026:  32 µg/L (reference range 15-150 µg/L).";
    const r = locateExcerpt(livePages, 2, modelExcerpt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.verifiedExcerpt).toBe("Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).");
    expect(r.verifiedExcerpt).not.toBe(modelExcerpt);
  });

  it("maps straight quotes back to the page's curly quotes", () => {
    const r = locateExcerpt(livePages, 2, 'Note: "continue routine care".');
    expect(r.ok && r.verifiedExcerpt).toBe("Note: “continue routine care”.");
  });

  it("maps a match that spans a line break back to the original text", () => {
    const r = locateExcerpt(livePages, 2, "RESULTS Ferritin on 25 Sep 2026");
    expect(r.ok && r.verifiedExcerpt).toBe("RESULTS\nFerritin on 25 Sep 2026");
  });

  it("fails when the excerpt is not on the stated page, even if it exists on another page", () => {
    const r = locateExcerpt(livePages, 1, "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).");
    expect(r.ok).toBe(false);
  });

  it("fails for a page that does not exist", () => {
    expect(locateExcerpt(livePages, 3, "anything").ok).toBe(false);
  });
});

describe("lab facts: subject AND value must come from the source", () => {
  const claim = { analyteName: "ferritin", value: 32, unit: "μg/L", referenceRangeText: null, measuredOn: "2026-09-25" };

  it("wrong subject fails: the model labels a B12 result as ferritin", () => {
    const r = verifyLabFact(claim, "Vitamin B12 32 μg/L 20–100", "2026-09-25");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/does not name the analyte/);
  });

  it("wrong binding fails: 32 belongs to B12, the value bound to ferritin is 20", () => {
    const r = verifyLabFact(claim, "Ferritin 20 μg/L; Vitamin B12 32 μg/L", "2026-09-25");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/binds 20/);
  });

  it("skips date numbers when binding the value to the analyte", () => {
    const r = verifyLabFact(
      { ...claim, referenceRangeText: "15–150" },
      "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).",
      "2026-09-25",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.refLow, r.refHigh, r.unit]).toEqual([15, 150, "μg/L"]);
  });

  it("a claimed range that is not in the source fails", () => {
    const r = verifyLabFact({ ...claim, referenceRangeText: "30–400" }, "Ferritin 32 μg/L 15–150", "2026-09-25");
    expect(r.ok).toBe(false);
  });

  it("a wrong unit fails", () => {
    const r = verifyLabFact({ ...claim, unit: "ng/mL" }, "Ferritin 32 μg/L 15–150", "2026-09-25");
    expect(r.ok).toBe(false);
  });

  it("an untracked analyte fails", () => {
    const r = verifyLabFact({ ...claim, analyteName: "Vitamin B12" }, "Vitamin B12 32 μg/L", "2026-09-25");
    expect(r.ok).toBe(false);
  });

  it("a date that is neither in the excerpt nor the document date fails", () => {
    const r = verifyLabFact({ ...claim, measuredOn: "2026-01-01" }, "Ferritin 32 μg/L 15–150", "2026-09-25");
    expect(r.ok).toBe(false);
  });
});

describe("medication facts: identity and status cue in the same sentence", () => {
  it("a generic statement fails: 'Treatment completed.' does not name oral iron", () => {
    const r = verifyMedicationFact({ medicationName: "oral iron", status: "completed" }, "Treatment completed.", episodes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/does not name the medication/);
  });

  it("a missing cue fails: naming ferrous sulfate is not evidence it was completed", () => {
    const r = verifyMedicationFact(
      { medicationName: "ferrous sulfate", status: "completed" },
      "The patient takes ferrous sulfate daily.",
      episodes,
    );
    expect(r.ok).toBe(false);
  });

  it("the cue must be in the SAME sentence as the medication", () => {
    const r = verifyMedicationFact(
      { medicationName: "oral iron", status: "completed" },
      "Oral iron was discussed. The course was completed.",
      episodes,
    );
    expect(r.ok).toBe(false);
  });

  it("'the prescribed course' is not evidence of a Prescribed status", () => {
    const r = verifyMedicationFact(
      { medicationName: "oral iron", status: "prescribed" },
      "The patient completed the prescribed course of oral iron (ferrous sulfate) in May 2026.",
      episodes,
    );
    expect(r.ok).toBe(false);
  });

  it("the live note sentence is not evidence of Completed", () => {
    const r = verifyMedicationFact({ medicationName: "oral iron (ferrous sulfate)", status: "completed" }, "The patient continues to take oral iron (ferrous sulfate) once daily.", episodes);
    expect(r.ok).toBe(false);
  });

  it("the live note sentence verifies as Current (shown as Ongoing)", () => {
    const r = verifyMedicationFact(
      { medicationName: "oral iron (ferrous sulfate)", status: "current" },
      "The patient continues to take oral iron (ferrous sulfate) once daily.",
      episodes,
    );
    expect(r.ok && [r.episodeId, r.status]).toEqual(["ep-oral-iron", "Current"]);
  });
});

describe("verifyExtraction (the live pipeline)", () => {
  it("happy path: both live-note facts verify with correct values, range and pages", () => {
    const r = verifyExtraction(livePages, goodExtraction, { documentId: "doc-new", episodes });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.excludedCount).toBe(0);
    expect(r.verified).toHaveLength(2);
    const lab = r.verified.find((f) => f.kind === "lab_measurement");
    const med = r.verified.find((f) => f.kind === "medication_status");
    expect(lab && lab.kind === "lab_measurement" && [lab.value, lab.refLow, lab.refHigh, lab.source.page]).toEqual([32, 15, 150, 2]);
    expect(med && med.kind === "medication_status" && [med.status, med.documentedOn, med.source.page]).toEqual([
      "Current",
      "2026-09-25",
      1,
    ]);
    expect(r.verified.every((f) => f.review === "PROPOSED")).toBe(true);
  });

  it("partial failure: one failing fact is excluded, the other still verifies", () => {
    const partial: Extraction = {
      ...goodExtraction,
      medicationStatements: [{ medicationName: "oral iron", status: "completed", page: 1, excerpt: "Follow-up of iron studies." }],
    };
    const r = verifyExtraction(livePages, partial, { documentId: "doc-new", episodes });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.verified).toHaveLength(1);
    expect(r.excludedCount).toBe(1);
    expect(r.verified[0].kind).toBe("lab_measurement");
  });

  it("every fact failing makes the extraction unusable", () => {
    const bad: Extraction = {
      ...goodExtraction,
      labMeasurements: [{ ...goodExtraction.labMeasurements[0], value: 99 }],
      medicationStatements: [],
    };
    expect(verifyExtraction(livePages, bad, { documentId: "doc-new", episodes }).status).toBe("unusable");
  });

  it("an unverifiable document date makes the extraction unusable", () => {
    const bad: Extraction = { ...goodExtraction, document: { ...goodExtraction.document, documentDate: "2026-09-26" } };
    expect(verifyExtraction(livePages, bad, { documentId: "doc-new", episodes }).status).toBe("unusable");
  });

  it("stores the canonical page wording, never the model's excerpt string", () => {
    const sloppy: Extraction = {
      ...goodExtraction,
      labMeasurements: [{ ...goodExtraction.labMeasurements[0], excerpt: "FERRITIN on 25 sep 2026: 32 µg/l (reference range 15-150 µg/l)." }],
    };
    const r = verifyExtraction(livePages, sloppy, { documentId: "doc-new", episodes });
    expect(r.status === "ok" && r.verified[0].source.verifiedExcerpt).toBe(
      "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).",
    );
  });
});
