/**
 * One authoritative source assertion unit per fact (final re-audit H2). The model's excerpt is only a search key:
 * code finds its ONE occurrence, takes the source sentence (medication) or result line (ferritin) that holds it,
 * and verifies only that unit. Headings above can only reject. The document date is derived from the header.
 * Every case runs the real verification path — `verifyExtraction` on full page text — and the six reproductions
 * from the audit are numbered.
 */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headerDocumentDate, verifyExtraction, type Extraction, type ExtractedLab, type ExtractedMedication } from "@/lib/extraction/verify";
import { readPdfPages } from "@/lib/extraction/pdfText";
import type { MedicationEpisode } from "@/lib/model/types";

const repo = path.resolve(__dirname, "..");
const episodes: MedicationEpisode[] = [{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }];
const ctx = { documentId: "doc-07", episodes };

/** A fictional note dated 25 Sep 2026 in its header, then the body lines given. */
const page = (...body: string[]) =>
  ["Elm Street Primary Care", "General practice (fictional) FOLLOW-UP CONSULTATION NOTE", "Patient Laurence Mercer (fictional)", "Date of consultation: 25 Sep 2026", ...body].join("\n");
const headerClaim = { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation: 25 Sep 2026" };
const run = (pages: string[], parts: Partial<Extraction>) =>
  verifyExtraction(pages, { document: headerClaim, labMeasurements: [], medicationStatements: [], ...parts }, ctx);
const med = (status: string, excerpt: string): ExtractedMedication => ({ medicationName: "oral iron (ferrous sulfate)", status, page: 1, excerpt });
const ferritin = (value: number, excerpt: string, measuredOn = "2026-09-25", referenceRangeText: string | null = null): ExtractedLab =>
  ({ analyteName: "Ferritin", value, unit: "μg/L", referenceRangeText, measuredOn, page: 1, excerpt });
const outcome = (r: ReturnType<typeof run>) => (r.status === "ok" ? r.verified.map((f) => f.kind) : r.code);
const reasons = (r: ReturnType<typeof run>) => (r.status === "ok" ? r.exclusions.map((e) => e.reason) : []);

describe("H2-A · oral iron status: only the one sentence holding the excerpt, about the patient, now", () => {
  const repro1 = page("MEDICATION HISTORY", "The patient is not currently taking oral iron. Her mother is currently taking oral iron.");
  it.each([
    ["the shared words, which occur twice", "currently taking oral iron"],
    ["the mother's sentence", "Her mother is currently taking oral iron."],
    ["the mother's sentence without its subject", "is currently taking oral iron."],
    ["the patient's own (negated) sentence", "The patient is not currently taking oral iron."],
    ["both sentences at once", "The patient is not currently taking oral iron. Her mother is currently taking oral iron."],
  ])("1 · patient-not / mother-currently: rejects %s", (_label, excerpt) => {
    expect(outcome(run([repro1], { medicationStatements: [med("current", excerpt)] }))).toBe("none_verified");
  });

  it("1 · an excerpt that occurs more than once is ambiguous, never resolved to either sentence", () => {
    const r = verifyExtraction([`${repro1}\nRESULTS\nFerritin on 25 Sep 2026: 32 μg/L`], {
      document: headerClaim,
      labMeasurements: [ferritin(32, "Ferritin on 25 Sep 2026: 32 μg/L")],
      medicationStatements: [med("current", "currently taking oral iron")],
    }, ctx);
    expect(reasons(r)).toEqual([expect.stringMatching(/occurs 2 times/)]);
  });

  it.each([
    ["the quoted sentence", "At the 27 Jan 2026 consultation, the patient was currently taking oral iron.", "current"],
    ["the quote without its dated framing", "the patient was currently taking oral iron.", "current"],
  ])("2 · historical 27 Jan statement in a 25 Sep note: rejects %s", (_label, excerpt, status) => {
    const p = page("MEDICATION HISTORY", "At the 27 Jan 2026 consultation, the patient was currently taking oral iron. Today the medication list is unknown.");
    expect(outcome(run([p], { medicationStatements: [med(status, excerpt)] }))).toBe("none_verified");
  });

  it.each([
    ["an earlier date, even in the present tense", "At the 27 Jan 2026 consultation, the patient is currently taking oral iron."],
    ["an earlier consultation without a date", "At her last consultation, the patient continues to take oral iron."],
    ["a stop dated before the document", "Oral iron was stopped on 1 Sep 2026."],
    ["a month-only date", "The patient completed the course of oral iron in May 2026."],
    ["'previously'", "The patient previously completed the course of oral iron."],
  ])("2 · never stores an earlier-time statement under the document date: rejects %s", (_label, sentence) => {
    const status = /stopped/.test(sentence) ? "stopped" : /completed/.test(sentence) ? "completed" : "current";
    expect(outcome(run([page("MEDICATION HISTORY", sentence)], { medicationStatements: [med(status, sentence)] }))).toBe("none_verified");
  });

  it.each([["IF NEEDED"], ["PREVIOUS MEDICATION"], ["HISTORICAL CONSULTATION"], ["FAMILY HISTORY"], ["PLAN"]])(
    "3 · a heading can only reject: '%s' above 'Oral iron was stopped.'",
    (heading) => {
      const r = run([page(heading, "Oral iron was stopped.")], { medicationStatements: [med("stopped", "Oral iron was stopped.")] });
      expect(outcome(r)).toBe("none_verified");
    },
  );

  it("3 · a heading counts all the way down the document, not just the nearest one", () => {
    const p = page("HISTORICAL CONSULTATION", "Seen by the practice.", "MEDICATION", "Oral iron was stopped.");
    expect(outcome(run([p], { medicationStatements: [med("stopped", "Oral iron was stopped.")] }))).toBe("none_verified");
  });

  it.each([
    ["third party", "The patient's mother continues to take oral iron."],
    ["a question", "Is the patient currently taking oral iron?"],
    ["a conditional", "If tolerated, the patient continues to take oral iron."],
    ["a recommendation", "The patient should continue to take oral iron; oral iron was not stopped."],
  ])("rejects %s", (_label, sentence) => {
    const status = /stopped/.test(sentence) ? "stopped" : "current";
    const excerpt = sentence.split(/(?<=[.;?])\s/)[0];
    expect(outcome(run([page("MEDICATION HISTORY", sentence)], { medicationStatements: [med(status, excerpt)] }))).toBe("none_verified");
  });

  it.each([
    ["prescribed", "Prescribed: ferrous sulfate 200 mg tablets, one tablet once daily for 3 months."],
    ["current", "The patient continues to take oral iron (ferrous sulfate) once daily."],
    ["current", "The patient is currently taking oral iron."],
    ["completed", "The patient completed the course of oral iron."],
    ["stopped", "Oral iron (ferrous sulfate) was stopped on 25 Sep 2026."],
    ["stopped", "Ferrous sulfate was discontinued."],
  ])("control · an affirmative %s statement about the patient still verifies, next to a negative sibling", (status, sentence) => {
    const p = page("MEDICATION HISTORY", sentence, "No other regular medication is recorded at this visit.", "IF NEEDED", "Review in clinic.");
    expect(outcome(run([p], { medicationStatements: [med(status, sentence)] }))).toEqual(["medication_status"]);
  });

  it("3 · control: the same sentence verifies under an ordinary heading", () => {
    const r = run([page("MEDICATION HISTORY", "Oral iron was stopped.")], { medicationStatements: [med("stopped", "Oral iron was stopped.")] });
    expect(outcome(r)).toEqual(["medication_status"]);
  });
});

describe("H2-B · the document date is derived from the header, never from a later section", () => {
  const repro4 = page(
    "MEDICATION HISTORY",
    "The patient continues to take oral iron (ferrous sulfate) once daily.",
    "HISTORICAL CONSULTATION",
    "Consultation date: 27 Jan 2026",
    "The patient is currently taking oral iron.",
  );

  it("4 · code derives 25 Sep 2026 from the header; the later 'Consultation date: 27 Jan 2026' never overrides it", () => {
    expect(headerDocumentDate(repro4)).toMatchObject({ ok: true, date: "2026-09-25" });
    const claim = (documentDate: string, excerpt: string) => verifyExtraction([repro4], {
      document: { documentType: "Consultation note", documentDate, page: 1, excerpt },
      labMeasurements: [], medicationStatements: [med("current", "The patient continues to take oral iron (ferrous sulfate) once daily.")],
    }, ctx);
    expect(claim("2026-01-27", "Consultation date: 27 Jan 2026")).toMatchObject({ status: "unusable", code: "document_date_unverified" });
    // the right date, but quoted from the historical section, is not the header's provenance either
    expect(claim("2026-09-25", "Consultation date: 27 Jan 2026")).toMatchObject({ status: "unusable", code: "document_date_unverified" });
    expect(claim("2026-09-25", "Date of consultation: 25 Sep 2026")).toMatchObject({ status: "ok", documentDate: "2026-09-25" });
  });

  it("4 · a status inside the historical section is not stored under the header date", () => {
    const r = run([repro4], {
      medicationStatements: [
        med("current", "The patient continues to take oral iron (ferrous sulfate) once daily."),
        med("current", "The patient is currently taking oral iron."),
      ],
    });
    expect(outcome(r)).toEqual(["medication_status"]);
    // both guards apply: the heading above it, and the 27 Jan date its (wrapped) sentence carries
    expect(reasons(r)).toEqual([expect.stringMatching(/HISTORICAL CONSULTATION|other than the document date/)]);
    const underHeadingOnly = page("MEDICATION HISTORY", "Seen today.", "HISTORICAL CONSULTATION", "The patient is currently taking oral iron.");
    expect(outcome(run([underHeadingOnly], { medicationStatements: [med("current", "The patient is currently taking oral iron.")] }))).toBe("none_verified");
  });

  it.each([
    ["two different labelled dates in the header", ["Date of consultation 25 Sep 2026", "Report date 27 Jan 2026"]],
    ["no labelled date in the header", ["Type Follow-up consultation"]],
    ["only result, sample or collection dates", ["Collection date 25 Sep 2026", "Result date 25 Sep 2026", "Sample date 25 Sep 2026", "Specimen date 25 Sep 2026"]],
    ["a qualified label", ["Previous report date: 25 Sep 2026", "Previous consultation date 25 Sep 2026"]],
  ])("fails closed on %s", (_label, headerLines) => {
    const p = ["Elm Street Primary Care", ...headerLines, "MEDICATION HISTORY", "Oral iron was stopped."].join("\n");
    expect(headerDocumentDate(p).ok).toBe(false);
    const r = verifyExtraction([p], {
      document: { documentType: "Consultation note", documentDate: "2026-09-25", page: 1, excerpt: headerLines[0] },
      labMeasurements: [], medicationStatements: [med("stopped", "Oral iron was stopped.")],
    }, ctx);
    expect(r).toMatchObject({ status: "unusable", code: "document_date_unverified" });
  });

  it("control · every seed document's header gives exactly its recorded date", async () => {
    const seed = JSON.parse(await readFile(path.join(repo, "data/seed/state.json"), "utf8")) as { documents: { file: string; date: string }[] };
    for (const doc of seed.documents) {
      const pages = await readPdfPages(new Uint8Array(await readFile(path.join(repo, "data/seed/documents", doc.file))));
      expect(headerDocumentDate(pages[0]), doc.file).toMatchObject({ ok: true, date: doc.date });
    }
  });
});

describe("H2-C · ferritin: one result line, exact scalar, nothing borrowed", () => {
  it.each([
    ["5 · '(or more)' after the value, left out of the quote", "Ferritin 150 μg/L (or more)", 150, "Ferritin 150 μg/L"],
    ["5 · '(or more)' quoted", "Ferritin 150 μg/L (or more)", 150, "Ferritin 150 μg/L (or more)"],
    ["a '>' bound", "Ferritin >150 μg/L", 150, "Ferritin >150 μg/L"],
    ["6 · 'Approximately' before the name, left out of the quote", "Approximately ferritin 32 μg/L.", 32, "ferritin 32 μg/L"],
    ["6 · '~' with the name after the value", "~32 μg/L ferritin", 32, "32 μg/L ferritin"],
    ["a qualifier at the end of the line", "Ferritin 32 μg/L, approx.", 32, "Ferritin 32 μg/L"],
    ["a value range", "Ferritin 30-40 μg/L", 40, "Ferritin 30-40 μg/L"],
    ["an earlier result named as such", "Previous ferritin 19.6 μg/L", 19.6, "ferritin 19.6 μg/L"],
    ["someone else's result", "Mother's ferritin 32 μg/L", 32, "ferritin 32 μg/L"],
  ])("rejects %s", (_label, line, value, excerpt) => {
    expect(outcome(run([page("RESULTS", line)], { labMeasurements: [ferritin(value, excerpt)] }))).toBe("none_verified");
  });

  it("rejects a result under a historical heading — it would otherwise be stored under the document date", () => {
    const p = page("PREVIOUS RESULTS", "Ferritin 19.6 μg/L 15–150");
    expect(outcome(run([p], { labMeasurements: [ferritin(19.6, "Ferritin 19.6 μg/L 15–150", "2026-09-25", "15–150")] }))).toBe("none_verified");
  });

  it("a dated result keeps its own date: the document date is never borrowed for it", () => {
    const p = page("RESULTS", "Ferritin on 27 Jan 2026: 19.6 μg/L (reference range 15–150 μg/L).");
    const excerpt = "Ferritin on 27 Jan 2026: 19.6 μg/L (reference range 15–150 μg/L).";
    expect(outcome(run([p], { labMeasurements: [ferritin(19.6, excerpt, "2026-09-25", "15–150 μg/L")] }))).toBe("none_verified");
    expect(outcome(run([p], { labMeasurements: [ferritin(19.6, excerpt, "2026-01-27", "15–150 μg/L")] }))).toEqual(["lab_measurement"]);
  });

  it("control · exact results still verify, with identity, value, unit and range from the same line", () => {
    const p = page("RESULTS", "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).", "Haemoglobin 12.9 g/dL 12.0–15.5");
    const r = run([p], { labMeasurements: [ferritin(32, "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).", "2026-09-25", "15–150 μg/L")] });
    expect(r.status === "ok" && r.verified.map((f) => (f.kind === "lab_measurement" ? [f.value, f.unit, f.refText, f.measuredOn] : null))).toEqual([
      [32, "μg/L", "15–150", "2026-09-25"],
    ]);
  });
});

describe("control · the live demo document still verifies end to end", () => {
  it("ferritin 32 μg/L (15–150) and oral iron Current, dated 25 Sep 2026 from its header, with exact provenance", async () => {
    const pages = await readPdfPages(new Uint8Array(await readFile(path.join(repo, "demo-files/follow-up-consultation-2026-09-25.pdf"))));
    expect(headerDocumentDate(pages[0])).toMatchObject({ ok: true, date: "2026-09-25" });
    const extraction: Extraction = {
      document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
      labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }],
      medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
    };
    const r = verifyExtraction(pages, extraction, ctx);
    expect(r).toMatchObject({ status: "ok", documentDate: "2026-09-25", excludedCount: 0 });
    if (r.status !== "ok") return;
    expect(r.verified).toEqual([
      expect.objectContaining({ kind: "lab_measurement", value: 32, unit: "μg/L", refLow: 15, refHigh: 150, measuredOn: "2026-09-25",
        source: { documentId: "doc-07", page: 2, verifiedExcerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." } }),
      expect.objectContaining({ kind: "medication_status", episodeId: "ep-oral-iron", status: "Current", documentedOn: "2026-09-25",
        source: { documentId: "doc-07", page: 1, verifiedExcerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." } }),
    ]);
  });
});
