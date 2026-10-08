/**
 * Meaning is judged on the AUTHORITATIVE SOURCE CONTEXT, not on the model's excerpt boundaries (re-audit H2).
 * Every case runs the real verification path — `verifyExtraction` on full page text, exactly as the pipeline
 * calls it — with a model excerpt that is a genuine substring of the page.
 */
import { describe, expect, it } from "vitest";
import { verifyExtraction, type Extraction, type ExtractedLab, type ExtractedMedication } from "@/lib/extraction/verify";
import type { MedicationEpisode } from "@/lib/model/types";

const episodes: MedicationEpisode[] = [{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }];
const ctx = { documentId: "doc-07", episodes };

/** A fictional note: header, the document date line, then the body lines given. */
const page = (...body: string[]) =>
  ["Elm Street Primary Care", "General practice (fictional) FOLLOW-UP CONSULTATION NOTE", "Patient Laurence Mercer (fictional)", "Date of consultation 2 Oct 2026", ...body].join("\n");
const documentClaim = { documentType: "Follow-up consultation note", documentDate: "2026-10-02", page: 1, excerpt: "Date of consultation 2 Oct 2026" };
const run = (pages: string[], parts: Partial<Extraction>) =>
  verifyExtraction(pages, { document: documentClaim, labMeasurements: [], medicationStatements: [], ...parts }, ctx);
const med = (status: string, excerpt: string): ExtractedMedication => ({ medicationName: "oral iron (ferrous sulfate)", status, page: 1, excerpt });
const ferritin = (value: number, excerpt: string, referenceRangeText: string | null = null): ExtractedLab =>
  ({ analyteName: "Ferritin", value, unit: "μg/L", referenceRangeText, measuredOn: "2026-10-02", page: 1, excerpt });
const verifiedKinds = (r: ReturnType<typeof run>) => (r.status === "ok" ? r.verified.map((f) => f.kind) : r.code);

describe("medication meaning comes from the whole source sentence", () => {
  it.each([
    ["negation omitted from the quote", "It is not true that the patient is currently taking oral iron.", "current", "the patient is currently taking oral iron."],
    ["negation on the previous line of a wrapped sentence", "It is not true that\nthe patient is currently taking oral iron.", "current", "the patient is currently taking oral iron."],
    ["conditional prefix omitted from the quote", "If tolerated, oral iron (ferrous sulfate) was prescribed.", "prescribed", "oral iron (ferrous sulfate) was prescribed."],
    ["conditional prefix with a different status", "Unless symptoms return, oral iron was stopped.", "stopped", "oral iron was stopped."],
    ["a question, quoted without its question mark", "Is the patient currently taking oral iron?", "current", "the patient currently taking oral iron"],
    ["a question about stopping", "Was oral iron stopped?", "stopped", "oral iron stopped"],
    ["a recommendation around the quote", "We recommend that the patient continues to take oral iron.", "current", "the patient continues to take oral iron."],
  ])("rejects: %s", (_label, sentence, status, excerpt) => {
    const r = run([page("MEDICATION HISTORY", sentence)], { medicationStatements: [med(status, excerpt)] });
    expect(r).toMatchObject({ status: "unusable", code: "none_verified" });
  });

  it.each([
    ["prescribed", "Prescribed: ferrous sulfate 200 mg tablets, one tablet once daily for 3 months."],
    ["current", "The patient continues to take oral iron (ferrous sulfate) once daily."],
    ["completed", "The patient completed the course of oral iron."],
    ["stopped", "Oral iron (ferrous sulfate) was stopped on 2 Oct 2026."], // the document's own date
  ])("verifies an affirmative %s statement (a neighbouring negative sentence does not leak in)", (status, sentence) => {
    const r = run([page("No other regular medication is recorded at this visit.", "MEDICATION HISTORY", sentence)], { medicationStatements: [med(status, sentence)] });
    expect(verifiedKinds(r)).toEqual(["medication_status"]);
  });
});

describe("the document date must be the current document's own date", () => {
  it("the correct consultation date verifies", () => {
    const r = run([page("Previous report date: 27 Jan 2026", "MEDICATION HISTORY", "Oral iron (ferrous sulfate) was stopped.")],
      { medicationStatements: [med("stopped", "Oral iron (ferrous sulfate) was stopped.")] });
    expect(verifiedKinds(r)).toEqual(["medication_status"]);
  });

  it.each([
    ["Previous report date: 27 Jan 2026", "report date: 27 Jan 2026"],
    ["Prior report date 27 Jan 2026", "report date 27 Jan 2026"],
    ["Previous consultation date 27 Jan 2026", "consultation date 27 Jan 2026"],
    ["Result date 27 Jan 2026", "Result date 27 Jan 2026"],
    ["Sample date 27 Jan 2026", "Sample date 27 Jan 2026"],
    ["Specimen date 27 Jan 2026", "Specimen date 27 Jan 2026"],
    ["Collection date 27 Jan 2026", "Collection date 27 Jan 2026"],
    ["Review of blood results from 27 Jan 2026.", "27 Jan 2026"],
  ])("rejects '%s' as the document date", (line, excerpt) => {
    const pages = [page(line, "MEDICATION HISTORY", "Oral iron was stopped on 1 Oct 2026.")];
    const r = verifyExtraction(pages, {
      document: { documentType: "Consultation note", documentDate: "2026-01-27", page: 1, excerpt },
      labMeasurements: [], medicationStatements: [med("stopped", "Oral iron was stopped on 1 Oct 2026.")],
    }, ctx);
    expect(r).toMatchObject({ status: "unusable", code: "document_date_unverified" });
  });

  it("with several dates on the document-date line, only the labelled one counts", () => {
    const pages = ["Elm Street Primary Care\nDate of consultation 3 Feb 2026 (results from 27 Jan 2026)\nMEDICATION HISTORY\nOral iron was stopped."];
    const claim = (documentDate: string, excerpt: string) => verifyExtraction(pages, {
      document: { documentType: "Consultation note", documentDate, page: 1, excerpt },
      labMeasurements: [], medicationStatements: [med("stopped", "Oral iron was stopped.")],
    }, ctx);
    expect(claim("2026-01-27", "results from 27 Jan 2026")).toMatchObject({ status: "unusable", code: "document_date_unverified" });
    expect(verifiedKinds(claim("2026-02-03", "Date of consultation 3 Feb 2026"))).toEqual(["medication_status"]);
  });
});

describe("ferritin values must be exact scalars", () => {
  it.each([
    ["Ferritin >150 μg/L (reference range 15–150 μg/L).", 150, "Ferritin >150 μg/L (reference range 15–150 μg/L).", "15–150 μg/L"],
    ["Ferritin <15 μg/L.", 15, "Ferritin <15 μg/L", null],
    ["Ferritin ≥ 300 μg/L.", 300, "Ferritin ≥ 300 μg/L", null],
    ["Ferritin ≤15 μg/L.", 15, "Ferritin ≤15 μg/L", null],
    ["Ferritin: 150 μg/L or more.", 150, "Ferritin: 150 μg/L", null], // the qualifier the quote cut off still counts
    ["Ferritin greater than 150 μg/L.", 150, "Ferritin greater than 150 μg/L", null],
    ["Ferritin approximately 32 μg/L.", 32, "Ferritin approximately 32 μg/L", null],
  ])("rejects %s as an exact value", (line, value, excerpt, range) => {
    const r = run([page("RESULTS", line)], { labMeasurements: [ferritin(value, excerpt, range)] });
    expect(r).toMatchObject({ status: "unusable", code: "none_verified" });
  });

  it.each([
    ["Ferritin on 2 Oct 2026: 41 μg/L (reference range 15–150 μg/L).", 41, "15–150 μg/L"],
    ["Ferritin 19.6 μg/L 15–150", 19.6, "15–150"],
    ["Ferritin 32 μg/L", 32, null],
  ])("verifies the exact value in '%s'", (line, value, range) => {
    const r = run([page("RESULTS", line)], { labMeasurements: [ferritin(value, line, range)] });
    expect(r.status === "ok" && r.verified.map((f) => (f.kind === "lab_measurement" ? [f.value, f.refText] : null))).toEqual([
      [value, range ? range.replace(" μg/L", "") : null],
    ]);
  });
});
