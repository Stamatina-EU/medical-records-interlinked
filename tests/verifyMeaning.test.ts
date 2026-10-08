/**
 * The verifier establishes MEANING, not just token presence (narrow, fail-closed rules):
 *  A. a medication status counts only when stated affirmatively for oral iron
 *  B. a document date counts only when the text states it as the document's own date
 *  C. a ferritin value, unit and supplied range must belong to the same result
 */
import { describe, expect, it } from "vitest";
import { verifyDocumentDate, verifyExtraction, verifyLabFact, verifyMedicationFact, type Extraction } from "@/lib/extraction/verify";
import type { MedicationEpisode } from "@/lib/model/types";

const episodes: MedicationEpisode[] = [{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }];
const med = (status: string, excerpt: string) => verifyMedicationFact({ medicationName: "oral iron", status }, excerpt, episodes);
const lab = (value: number, unit: string, referenceRangeText: string | null, excerpt: string) =>
  verifyLabFact({ analyteName: "Ferritin", value, unit, referenceRangeText, measuredOn: "2026-09-25" }, excerpt, "2026-09-25");

describe("A · medication status must be stated affirmatively", () => {
  it.each([
    ["prescribed", "Prescribed: ferrous sulfate 200 mg tablets, one tablet once daily for 3 months."],
    ["prescribed", "Oral iron (ferrous sulfate) was prescribed on 3 Feb 2026."],
    ["current", "The patient continues to take oral iron (ferrous sulfate) once daily."],
    ["current", "The patient is currently taking oral iron."],
    ["completed", "The patient completed the course of oral iron."],
    ["completed", "Oral iron (ferrous sulfate) was completed in May 2026."],
    ["stopped", "Oral iron was stopped on 1 Oct 2026."],
    ["stopped", "Ferrous sulfate was discontinued."],
  ])("verifies %s: %s", (status, excerpt) => {
    expect(med(status, excerpt).ok).toBe(true);
  });

  it.each([
    ["completed", "Oral iron was not completed.", "negation"],
    ["completed", "The patient has not finished the course of oral iron.", "negation"],
    ["stopped", "Oral iron wasn't stopped.", "negation"],
    ["current", "The patient is no longer currently taking oral iron.", "negation"],
    ["current", "The patient denies currently taking oral iron.", "negation"],
    ["prescribed", "If ferritin stays low, oral iron will be prescribed.", "conditional / future"],
    ["stopped", "Oral iron may be stopped if side effects occur.", "hypothetical"],
    ["stopped", "Oral iron should be stopped.", "recommendation"],
    ["current", "Recommend that the patient continues to take oral iron.", "recommendation"],
    ["completed", "Plan: oral iron to be completed by June.", "plan"],
    ["completed", "Oral iron will be completed in May 2026.", "future"],
    ["stopped", "Vitamin D was stopped and oral iron was started.", "the cue belongs to another medication"],
    ["completed", "The patient continues to take oral iron (ferrous sulfate) once daily.", "no Completed cue"],
  ])("rejects %s: %s (%s)", (status, excerpt) => {
    expect(med(status, excerpt).ok).toBe(false);
  });
});

describe("B · the document date must be stated as the document's date", () => {
  // the 3 Feb 2026 consultation note (doc-04), as the verifier reads it
  const consultation = [
    "Elm Street Primary Care\nGeneral practice (fictional) CONSULTATION NOTE\nPatient Laurence Mercer (fictional)\nDate of consultation 3 Feb 2026\nType Review of recent blood results\nREASON FOR VISIT\nReview of blood results from 27 Jan 2026.\nDISCUSSION\nResults reviewed with the patient.\nPLAN\nStart oral iron (ferrous sulfate 200 mg) once daily for 3 months.\nRepeat ferritin in 3 months.",
  ];
  const extraction = (documentDate: string, excerpt: string): Extraction => ({
    document: { documentType: "Consultation note", documentDate, page: 1, excerpt },
    labMeasurements: [],
    medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "prescribed", page: 1, excerpt: "Start oral iron (ferrous sulfate 200 mg) once daily for 3 months." }],
  });

  it("the actual document date verifies", () => {
    expect(verifyDocumentDate("2026-02-03", "Date of consultation 3 Feb 2026").ok).toBe(true);
    expect(verifyDocumentDate("2026-09-25", "Date of consultation 25 Sep 2026").ok).toBe(true);
    expect(verifyDocumentDate("2026-01-27", "Report date 27 Jan 2026").ok).toBe(true);
    expect(verifyDocumentDate("2026-02-03", "Date issued 3 Feb 2026").ok).toBe(true);
    expect(verifyDocumentDate("2026-02-03", "Date: 3 Feb 2026").ok).toBe(true);
  });

  it("an earlier results date in the same document does not verify as the document date", () => {
    expect(verifyDocumentDate("2026-01-27", "Review of blood results from 27 Jan 2026.").ok).toBe(false);
    const r = verifyExtraction(consultation, extraction("2026-01-27", "Review of blood results from 27 Jan 2026."), { documentId: "doc-07", episodes });
    expect(r).toMatchObject({ status: "unusable", code: "document_date_unverified" });
  });

  it("other dated lines are not the document date either", () => {
    expect(verifyDocumentDate("2026-01-27", "Collection date 27 Jan 2026").ok).toBe(false);
    expect(verifyDocumentDate("2026-09-25", "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).").ok).toBe(false);
    expect(verifyDocumentDate("2026-02-03", "Date of consultation 25 Sep 2026").ok).toBe(false); // label, wrong date
  });
});

describe("C · value, unit and supplied range must belong to the same ferritin result", () => {
  it("binds a range written with the result", () => {
    const sentence = lab(32, "μg/L", "15–150 μg/L", "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).");
    expect(sentence).toMatchObject({ ok: true, refLow: 15, refHigh: 150 });
    expect(lab(19.6, "μg/L", "15–150", "Ferritin 19.6 μg/L 15–150")).toMatchObject({ ok: true, refLow: 15, refHigh: 150 });
  });

  it("never borrows an unrelated range from elsewhere in the excerpt", () => {
    expect(lab(32, "μg/L", "12.0–15.5", "Ferritin 32 μg/L. Haemoglobin 12.9 g/dL 12.0–15.5").ok).toBe(false);
    expect(lab(32, "μg/L", "20–50", "Ferritin 32 μg/L; transferrin saturation 18 % 20–50").ok).toBe(false);
    // without a claimed range the ferritin result itself still verifies
    expect(lab(32, "μg/L", null, "Ferritin 32 μg/L. Haemoglobin 12.9 g/dL 12.0–15.5")).toMatchObject({ ok: true, refText: null });
  });

  it("never takes another test's value as the ferritin result", () => {
    expect(lab(12.9, "g/dL", null, "Ferritin pending, haemoglobin 12.9 g/dL").ok).toBe(false);
    expect(lab(12.9, "g/dL", null, "Ferritin was requested. Haemoglobin 12.9 g/dL.").ok).toBe(false);
  });
});
