/**
 * The verifier's POSITIVE GRAMMAR (final re-audit). A fact is Verified only if its COMPLETE authoritative source unit
 * — the whole sentence (oral iron), the whole physical result line (ferritin), the whole header line (document
 * date) — matches one of the supported structures in `lib/extraction/grammar.ts`. Table-driven:
 *  A. POSITIVE corpus: every committed seed and live example, plus the spacing/punctuation variants the grammar
 *     intentionally claims;
 *  B. NEGATIVE boundary corpus: the audit reproductions, the same tokens in another grammatical relationship, second
 *     values and ranges, trailing corrections and qualifiers, other subjects, unsupported sections;
 *  C. the invariant: every positive unit, mutated by inserting material outside the grammar, can no longer verify.
 * Every case runs the real verification path (`verifyExtraction` on full page text); no general English is involved.
 */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headerDocumentDate, verifyExtraction, verifySeedState, type Extraction } from "@/lib/extraction/verify";
import { readPdfPages } from "@/lib/extraction/pdfText";
import type { MedicationEpisode, TrustedState } from "@/lib/model/types";

const repo = path.resolve(__dirname, "..");
const episodes: MedicationEpisode[] = [{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }];
const ctx = { documentId: "doc-07", episodes };
const HEADER = ["Elm Street Primary Care", "General practice (fictional) FOLLOW-UP CONSULTATION NOTE", "Patient Laurence Mercer (fictional)", "Date of consultation 25 Sep 2026"];
const docClaim = { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" };
const page = (...body: string[]) => [...HEADER, ...body].join("\n");
const run = (pages: string[], parts: Partial<Extraction>) =>
  verifyExtraction(pages, { document: docClaim, labMeasurements: [], medicationStatements: [], ...parts }, ctx);
const verified = (r: ReturnType<typeof run>) => (r.status === "ok" ? r.verified : []);

/** Verify one oral-iron sentence (claimed with `status`) placed under `section`. */
const medicationVerifies = (sentence: string, status: string, section = "MEDICATION HISTORY", excerpt = sentence) =>
  verified(run([page(section, sentence)], { medicationStatements: [{ medicationName: "oral iron", status, page: 1, excerpt }] })).length === 1;

/** Verify one ferritin claim against the page body given; returns the verified fact or null. */
const ferritinFact = (body: string[], excerpt: string, value: number, referenceRangeText: string | null = null, measuredOn = "2026-09-25", unit = "μg/L") => {
  const facts = verified(run([page(...body)], { labMeasurements: [{ analyteName: "Ferritin", value, unit, referenceRangeText, measuredOn, page: 1, excerpt }] }));
  return facts[0] ?? null;
};

const TABLE = "TEST RESULT UNITS REFERENCE RANGE";

// ─── Oral iron status ─────────────────────────────────────────────────────────────────────
const MEDICATION_POSITIVE: [string, string, string][] = [
  // [why, status, complete sentence]
  ["seed doc-05 (prescription)", "prescribed", "Prescribed: ferrous sulfate 200 mg tablets, one tablet once daily for 3 months."],
  ["live demo note", "current", "The patient continues to take oral iron (ferrous sulfate) once daily."],
  ["second follow-up fixture", "stopped", "Oral iron (ferrous sulfate) was stopped."],
  ["Prescribed, passive", "prescribed", "Oral iron was prescribed."],
  ["Prescribed, passive with both names", "prescribed", "Oral iron (ferrous sulfate) was prescribed."],
  ["Current, 'is currently taking'", "current", "The patient is currently taking oral iron."],
  ["Current, another accepted name", "current", "The patient continues to take ferrous sulfate."],
  ["Completed, patient as subject", "completed", "The patient completed oral iron."],
  ["Completed, passive", "completed", "Oral iron was completed."],
  ["Stopped, patient as subject", "stopped", "The patient stopped oral iron."],
  ["Stopped, 'discontinued'", "stopped", "Ferrous sulfate was discontinued."],
  ["variant: British spelling", "stopped", "Ferrous sulphate was stopped."],
  ["variant: space before the label colon", "prescribed", "Prescribed : ferrous sulfate 200 mg tablets."],
  ["variant: a sentence wrapped over two lines, doubled spaces", "current", "The patient  continues to take oral iron (ferrous sulfate)\nonce daily."],
];

const MEDICATION_NEGATIVE: [string, string, string][] = [
  // the audit reproductions: the status is not bound to oral iron, or not to the patient
  ["audit · another medication, oral iron only mentioned", "current", "The patient is currently taking vitamin D instead of oral iron."],
  ["audit · another medication completed", "completed", "The patient completed amoxicillin before starting oral iron."],
  ["audit · another medication stopped (as Prescribed)", "prescribed", "The patient stopped ibuprofen after oral iron was prescribed."],
  ["audit · another medication stopped (as Stopped)", "stopped", "The patient stopped ibuprofen after oral iron was prescribed."],
  ["audit · another medication prescribed", "prescribed", "Vitamin D was prescribed in place of oral iron."],
  ["audit · a third-party subject", "completed", "Her niece completed oral iron."],
  // the same tokens in another relationship
  ["the patient's relative as subject", "current", "The patient's mother continues to take oral iron."],
  ["prescribed to someone else", "prescribed", "Oral iron was prescribed to her mother."],
  ["two medications, one verb", "stopped", "The patient stopped oral iron and vitamin D."],
  ["a stop that was undone", "stopped", "Oral iron was stopped and restarted."],
  ["either of two statuses", "stopped", "Oral iron was stopped or completed."],
  ["the adjective 'prescribed'", "prescribed", "The patient completed the prescribed course of oral iron."],
  ["the wrong status for the sentence", "completed", "The patient continues to take oral iron (ferrous sulfate) once daily."],
  // questions, negation, conditions, plans
  ["a question", "current", "Is the patient currently taking oral iron?"],
  ["a negation", "current", "The patient is not currently taking oral iron."],
  ["a contracted negation", "completed", "Oral iron wasn't completed."],
  ["a negated stop", "stopped", "Oral iron was not stopped."],
  ["a condition before it", "prescribed", "If tolerated, oral iron was prescribed."],
  ["a condition after it", "stopped", "Oral iron was stopped if needed."],
  ["the future", "prescribed", "Oral iron will be prescribed."],
  ["a recommendation", "stopped", "Oral iron should be stopped."],
  // earlier times and dates
  ["past tense is not Current", "current", "The patient was currently taking oral iron."],
  ["an earlier consultation", "current", "At the 27 Jan 2026 consultation, the patient was currently taking oral iron."],
  ["a dated stop", "stopped", "Oral iron was stopped on 1 Sep 2026."],
  ["a stop dated on the document date (dates are not in the grammar)", "stopped", "Oral iron was stopped on 25 Sep 2026."],
  ["'previously'", "completed", "The patient previously completed oral iron."],
  ["a month", "prescribed", "Oral iron was prescribed in May 2026."],
  // outside the narrow grammar (accepted false negatives)
  ["'the course of'", "completed", "The patient completed the course of oral iron."],
  ["a pronoun subject", "current", "She is currently taking oral iron."],
];

describe("oral iron status · positive grammar", () => {
  it.each(MEDICATION_POSITIVE)("A · verifies %s", (_why, status, sentence) => {
    expect(medicationVerifies(sentence, status)).toBe(true);
  });

  it("A · the excerpt may leave out only the final full stop", () => {
    expect(medicationVerifies("The patient is currently taking oral iron.", "current", "MEDICATION HISTORY", "The patient is currently taking oral iron")).toBe(true);
    expect(medicationVerifies("The patient is currently taking oral iron.", "current", "MEDICATION HISTORY", "currently taking oral iron.")).toBe(false);
  });

  it("A · both supported medication sections", () => {
    expect(medicationVerifies("Oral iron was stopped.", "stopped", "MEDICATION")).toBe(true);
    expect(medicationVerifies("Oral iron was stopped.", "stopped", "MEDICATION HISTORY")).toBe(true);
  });

  it.each(MEDICATION_NEGATIVE)("B · rejects %s", (_why, status, sentence) => {
    expect(medicationVerifies(sentence, status)).toBe(false);
  });

  it.each([
    ["text after it on the same line", "Oral iron was stopped. This is incorrect."],
    ["text before it on the same line", "Seen today. Oral iron was stopped."],
    ["a sibling statement on the same line", "Oral iron was stopped. Her mother's oral iron was not."],
  ])("B · rejects a supported sentence that shares its line with %s", (_why, line) => {
    expect(medicationVerifies(line, "stopped", "MEDICATION HISTORY", "Oral iron was stopped.")).toBe(false);
  });

  it.each([["IF NEEDED"], ["HISTORICAL CONSULTATION"], ["PREVIOUS MEDICATION"], ["FAMILY HISTORY"], ["PLAN"], ["RESULTS"]])(
    "B · rejects a supported sentence outside a supported medication section: %s",
    (section) => expect(medicationVerifies("Oral iron was stopped.", "stopped", section)).toBe(false),
  );

  it("B · rejects a supported section nested under an unsupported heading", () => {
    const r = run([page("HISTORICAL CONSULTATION", "Seen by the practice.", "MEDICATION", "Oral iron was stopped.")], {
      medicationStatements: [{ medicationName: "oral iron", status: "stopped", page: 1, excerpt: "Oral iron was stopped." }],
    });
    expect(verified(r)).toEqual([]);
  });
});

// ─── Ferritin ─────────────────────────────────────────────────────────────────────────────
const SEED_D1 = ["HAEMATOLOGY AND IRON STUDIES", TABLE, "Haemoglobin 12.6 g/dL 12.0–15.5", "Ferritin 11 μg/L 30–400", "Reference ranges are supplied by Northfield Diagnostics and apply to this laboratory's methods."];
const SEED_D3 = ["IRON STUDIES", TABLE, "Ferritin 19.6 μg/L 15–150", "Reference ranges are supplied by Riverside Clinical Laboratory and may differ from other laboratories."];
const LIVE = "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).";

const FERRITIN_POSITIVE: [string, string[], string, number, string | null, string][] = [
  // [why, page body, excerpt (= the complete line), value, claimed range, measured on]
  ["seed doc-01 (table row)", SEED_D1, "Ferritin 11 μg/L 30–400", 11, "30–400", "2026-09-25"],
  ["seed doc-03 (table row)", SEED_D3, "Ferritin 19.6 μg/L 15–150", 19.6, "15–150", "2026-09-25"],
  ["live demo note (sentence)", ["RESULTS", LIVE], LIVE, 32, "15–150 μg/L", "2026-09-25"],
  ["a table row, range not claimed", SEED_D3, "Ferritin 19.6 μg/L 15–150", 19.6, null, "2026-09-25"],
  ["a table row ending the page", ["IRON STUDIES", TABLE, "Ferritin 19.6 μg/L 15–150"], "Ferritin 19.6 μg/L 15–150", 19.6, "15–150", "2026-09-25"],
  ["a table row followed by another row, then a heading", ["IRON STUDIES", TABLE, "Ferritin 19.6 μg/L 15–150", "Haemoglobin 12.9 g/dL 12.0–15.5", "PLAN"], "Ferritin 19.6 μg/L 15–150", 19.6, "15–150", "2026-09-25"],
  ["a sentence, no date, no range", ["RESULTS", "Ferritin 32 μg/L."], "Ferritin 32 μg/L.", 32, null, "2026-09-25"],
  ["a sentence with a colon", ["RESULTS", "Ferritin: 32 μg/L."], "Ferritin: 32 μg/L.", 32, null, "2026-09-25"],
  ["a sentence with its own (earlier) date", ["RESULTS", "Ferritin on 27 Jan 2026: 19.6 μg/L."], "Ferritin on 27 Jan 2026: 19.6 μg/L.", 19.6, null, "2026-01-27"],
  ["variant: 'serum ferritin', ng/mL, hyphen range", ["RESULTS", "Serum ferritin 32 ng/mL (reference range 15-150 ng/mL)."], "Serum ferritin 32 ng/mL (reference range 15-150 ng/mL).", 32, "15-150", "2026-09-25"],
  ["variant: spaced colon and dash, range without unit", ["RESULTS", "Ferritin on 25 Sep 2026 : 32 μg/L (reference range 15 – 150)."], "Ferritin on 25 Sep 2026 : 32 μg/L (reference range 15 – 150).", 32, "15–150", "2026-09-25"],
  ["variant: micro sign µ for μ", ["RESULTS", "Ferritin 32 µg/L."], "Ferritin 32 µg/L.", 32, null, "2026-09-25"],
];

const FERRITIN_NEGATIVE: [string, string[], string, number, string | null][] = [
  // the audit reproductions
  ["audit · a second value ('to')", ["RESULTS", "Ferritin 32 μg/L to 41 μg/L."], "Ferritin 32 μg/L to 41 μg/L.", 32, null],
  ["audit · a second value ('to'), claimed as the second", ["RESULTS", "Ferritin 32 μg/L to 41 μg/L."], "Ferritin 32 μg/L to 41 μg/L.", 41, null],
  ["audit · a corrected result", ["RESULTS", "Ferritin 32 μg/L (corrected result: 41 μg/L)."], "Ferritin 32 μg/L (corrected result: 41 μg/L).", 32, null],
  ["audit · a corrected range on the next line (first line quoted)", ["RESULTS", "Ferritin 19.6 ng/mL", "(reference range 15-150 ng/mL, corrected range 30-400 ng/mL)."], "Ferritin 19.6 ng/mL", 19.6, null],
  ["audit · a corrected range on the next line (both lines quoted)", ["RESULTS", "Ferritin 19.6 ng/mL", "(reference range 15-150 ng/mL, corrected range 30-400 ng/mL)."], "Ferritin 19.6 ng/mL\n(reference range 15-150 ng/mL, corrected range 30-400 ng/mL).", 19.6, "15-150"],
  ["audit · 'Estimated result.' on the same line (whole line quoted)", ["RESULTS", "Ferritin 150 ng/mL (reference range 15-150 ng/mL). Estimated result."], "Ferritin 150 ng/mL (reference range 15-150 ng/mL). Estimated result.", 150, "15-150"],
  ["audit · 'Estimated result.' on the same line (result quoted)", ["RESULTS", "Ferritin 150 ng/mL (reference range 15-150 ng/mL). Estimated result."], "Ferritin 150 ng/mL (reference range 15-150 ng/mL).", 150, "15-150"],
  ["audit · 'Approximately' on the line before", ["RESULTS", "Approximately", "Ferritin 32 μg/L."], "Ferritin 32 μg/L.", 32, null],
  ["audit · a '>' bound", ["RESULTS", "Ferritin >150 μg/L."], "Ferritin >150 μg/L.", 150, null],
  ["audit · '(or more)'", ["RESULTS", "Ferritin 150 μg/L (or more)."], "Ferritin 150 μg/L (or more).", 150, null],
  ["audit · '~' and the name after the value", ["RESULTS", "~32 μg/L ferritin."], "~32 μg/L ferritin.", 32, null],
  // second values and ranges
  ["two values", ["RESULTS", "Ferritin 32 μg/L 41 μg/L."], "Ferritin 32 μg/L 41 μg/L.", 32, null],
  ["two values, comma", ["RESULTS", "Ferritin 32 μg/L, 41 μg/L."], "Ferritin 32 μg/L, 41 μg/L.", 32, null],
  ["a value range", ["RESULTS", "Ferritin 30-40 μg/L."], "Ferritin 30-40 μg/L.", 40, null],
  ["two ranges", ["RESULTS", "Ferritin 32 μg/L (reference range 15–150 μg/L) (reference range 30–400 μg/L)."], "Ferritin 32 μg/L (reference range 15–150 μg/L) (reference range 30–400 μg/L).", 32, "15–150"],
  ["a range in another unit", ["RESULTS", "Ferritin 32 μg/L (reference range 15–150 ng/mL)."], "Ferritin 32 μg/L (reference range 15–150 ng/mL).", 32, "15–150"],
  ["a table row with a correction on the next line", ["IRON STUDIES", TABLE, "Ferritin 19.6 μg/L 15–150", "(corrected range 30–400)"], "Ferritin 19.6 μg/L 15–150", 19.6, "15–150"],
  ["a table row with a qualifying line after it", ["IRON STUDIES", TABLE, "Ferritin 19.6 μg/L 15–150", "Estimated result."], "Ferritin 19.6 μg/L 15–150", 19.6, "15–150"],
  ["a table row outside a table", ["RESULTS", "Ferritin 19.6 μg/L 15–150"], "Ferritin 19.6 μg/L 15–150", 19.6, "15–150"],
  ["a table row after a non-row line", ["IRON STUDIES", TABLE, "Approximately", "Ferritin 19.6 μg/L 15–150"], "Ferritin 19.6 μg/L 15–150", 19.6, "15–150"],
  ["a row without its range column", ["IRON STUDIES", TABLE, "Ferritin 19.6 μg/L"], "Ferritin 19.6 μg/L", 19.6, null],
  // trailing and leading qualifiers, other subjects
  ["a trailing qualifier", ["RESULTS", "Ferritin 32 μg/L (estimated)."], "Ferritin 32 μg/L (estimated).", 32, null],
  ["a trailing abbreviation", ["RESULTS", "Ferritin 32 μg/L approx."], "Ferritin 32 μg/L approx.", 32, null],
  ["a trailing correction", ["RESULTS", "Ferritin 32 μg/L, corrected."], "Ferritin 32 μg/L, corrected.", 32, null],
  ["an earlier result", ["RESULTS", "Previous ferritin 19.6 μg/L."], "Previous ferritin 19.6 μg/L.", 19.6, null],
  ["someone else's result", ["RESULTS", "Mother's ferritin 32 μg/L."], "Mother's ferritin 32 μg/L.", 32, null],
  ["a planned test", ["RESULTS", "Repeat ferritin 32 μg/L."], "Repeat ferritin 32 μg/L.", 32, null],
  ["a question", ["RESULTS", "Ferritin 32 μg/L?"], "Ferritin 32 μg/L?", 32, null],
  // the quote and the line
  ["a quote that is only part of the line", ["RESULTS", LIVE], "Ferritin on 25 Sep 2026: 32 μg/L", 32, null],
  ["an impossible date", ["RESULTS", "Ferritin on 31 Feb 2026: 32 μg/L."], "Ferritin on 31 Feb 2026: 32 μg/L.", 32, null],
  ["an unsupported section", ["PREVIOUS RESULTS", "Ferritin 32 μg/L."], "Ferritin 32 μg/L.", 32, null],
  ["a medication section", ["MEDICATION HISTORY", "Ferritin 32 μg/L."], "Ferritin 32 μg/L.", 32, null],
];

describe("ferritin · strict result-line grammar", () => {
  it.each(FERRITIN_POSITIVE)("A · verifies %s", (_why, body, excerpt, value, range, measuredOn) => {
    const fact = ferritinFact(body, excerpt, value, range, measuredOn, /ng\/mL/.test(excerpt) ? "ng/mL" : "μg/L");
    expect(fact).toMatchObject({ kind: "lab_measurement", value, measuredOn, refText: range ? range.replace(/ ?μg\/L$/, "").replace(/ ?[-–] ?/, "–") : null });
  });

  it("A · a result with no date of its own is dated by the document, never a borrowed date", () => {
    expect(ferritinFact(["RESULTS", "Ferritin 32 μg/L."], "Ferritin 32 μg/L.", 32, null, "2026-01-27")).toBeNull();
    expect(ferritinFact(["RESULTS", "Ferritin on 27 Jan 2026: 19.6 μg/L."], "Ferritin on 27 Jan 2026: 19.6 μg/L.", 19.6, null, "2026-09-25")).toBeNull();
  });

  it.each(FERRITIN_NEGATIVE)("B · rejects %s", (_why, body, excerpt, value, range) => {
    expect(ferritinFact(body, excerpt, value, range)).toBeNull();
  });

  it("B · the right line with the wrong value, unit or range claimed", () => {
    expect(ferritinFact(["RESULTS", LIVE], LIVE, 31, "15–150 μg/L")).toBeNull();
    expect(ferritinFact(["RESULTS", LIVE], LIVE, 32, "15–150 μg/L", "2026-09-25", "ng/mL")).toBeNull();
    expect(ferritinFact(["RESULTS", LIVE], LIVE, 32, "30–400 μg/L")).toBeNull();
    expect(ferritinFact(["RESULTS", "Ferritin 32 μg/L."], "Ferritin 32 μg/L.", 32, "15–150")).toBeNull(); // no range written
  });
});

// ─── Document date ────────────────────────────────────────────────────────────────────────
const headerWith = (...lines: string[]) => ["Elm Street Primary Care", "Patient Laurence Mercer (fictional)", ...lines, "MEDICATION HISTORY", "Oral iron was stopped."].join("\n");

const HEADER_POSITIVE: [string, string, string][] = [
  ["Date:", "Date: 25 Sep 2026", "2026-09-25"],
  ["Date", "Date 25 Sep 2026", "2026-09-25"],
  ["Report date (seed doc-01, doc-03)", "Report date 14 Mar 2025", "2025-03-14"],
  ["Report date:", "Report date: 14 Mar 2025", "2025-03-14"],
  ["Consultation date:", "Consultation date: 27 Jan 2026", "2026-01-27"],
  ["Date of consultation (seed doc-04, live note)", "Date of consultation 25 Sep 2026", "2026-09-25"],
  ["Date of consultation:", "Date of consultation: 25 Sep 2026", "2026-09-25"],
  ["Date issued (seed doc-05)", "Date issued 3 Feb 2026", "2026-02-03"],
  ["Examination date (seed doc-02, doc-06)", "Examination date 10 Sep 2025", "2025-09-10"],
  ["variant: space before the colon, doubled spaces", "Date of consultation :  25 Sep 2026", "2026-09-25"],
];

const HEADER_NEGATIVE: [string, string[]][] = [
  ["audit · two dates and '(uncertain)'", ["Date of consultation 25 Sep 2026 or 26 Sep 2026 (uncertain)."]],
  ["audit · a question mark", ["Date of consultation 25 Sep 2026?"]],
  ["audit · '(previous consultation)'", ["Date of consultation 25 Sep 2026 (previous consultation)."]],
  ["another date role after the date", ["Date of consultation 3 Feb 2026 (results from 27 Jan 2026)"]],
  ["a qualifier before the date", ["Date of consultation (approx.) 25 Sep 2026"]],
  ["two dates", ["Date of consultation 25 Sep 2026 / 26 Sep 2026"]],
  ["an unsupported date form (full month)", ["Date of consultation: 25 September 2026"]],
  ["an unsupported date form (ISO)", ["Date of consultation 2026-09-25"]],
  ["two header date lines that disagree", ["Date of consultation 25 Sep 2026", "Report date 26 Sep 2026"]],
  ["a valid line next to a malformed one", ["Date: 25 Sep 2026", "Date of consultation 25 Sep 2026?"]],
  ["only other date roles", ["Collection date 25 Sep 2026", "Result date 25 Sep 2026", "Sample date 25 Sep 2026"]],
  ["a qualified label", ["Previous consultation date 25 Sep 2026"]],
  ["no date at all", ["Type Follow-up consultation"]],
];

describe("document date · strict header grammar", () => {
  it.each(HEADER_POSITIVE)("A · derives the date from '%s'", (_why, line, iso) => {
    const p = headerWith("Collection date 1 Jan 2025", "Requested by Primary care clinic", line);
    expect(headerDocumentDate(p)).toMatchObject({ ok: true, date: iso });
    const r = verifyExtraction([p], {
      document: { documentType: "Note", documentDate: iso, page: 1, excerpt: line },
      labMeasurements: [], medicationStatements: [{ medicationName: "oral iron", status: "stopped", page: 1, excerpt: "Oral iron was stopped." }],
    }, ctx);
    expect(r).toMatchObject({ status: "ok", documentDate: iso });
  });

  it("A · a header line that is not a document date (date of birth) is just other metadata", () => {
    expect(headerDocumentDate(headerWith("Date of birth 1 Jan 1980", "Date of consultation 25 Sep 2026"))).toMatchObject({ ok: true, date: "2026-09-25" });
  });

  it.each(HEADER_NEGATIVE)("B · fails closed on %s", (_why, lines) => {
    const p = headerWith(...lines);
    expect(headerDocumentDate(p).ok).toBe(false);
    const r = verifyExtraction([p], {
      document: { documentType: "Note", documentDate: "2026-09-25", page: 1, excerpt: lines[0] },
      labMeasurements: [], medicationStatements: [{ medicationName: "oral iron", status: "stopped", page: 1, excerpt: "Oral iron was stopped." }],
    }, ctx);
    expect(r).toMatchObject({ status: "unusable", code: "document_date_unverified" });
  });

  it("B · a body 'Consultation date' below a heading never competes with the header date", () => {
    const p = [...HEADER, "MEDICATION HISTORY", "Oral iron was stopped.", "HISTORICAL CONSULTATION", "Consultation date: 27 Jan 2026"].join("\n");
    expect(headerDocumentDate(p)).toMatchObject({ ok: true, date: "2026-09-25" });
    const claim = (documentDate: string, excerpt: string) => run([p], {
      document: { documentType: "Note", documentDate, page: 1, excerpt },
      medicationStatements: [{ medicationName: "oral iron", status: "stopped", page: 1, excerpt: "Oral iron was stopped." }],
    });
    expect(claim("2026-01-27", "Consultation date: 27 Jan 2026")).toMatchObject({ code: "document_date_unverified" });
    expect(claim("2026-09-25", "Consultation date: 27 Jan 2026")).toMatchObject({ code: "document_date_unverified" });
    expect(claim("2026-09-25", "Date of consultation 25 Sep 2026")).toMatchObject({ status: "ok" });
    // with no date in the header, the body date is still not the document date
    const noHeaderDate = ["Elm Street Primary Care", "MEDICATION HISTORY", "Oral iron was stopped.", "Consultation date: 27 Jan 2026"].join("\n");
    expect(headerDocumentDate(noHeaderDate).ok).toBe(false);
  });
});

// ─── C. The invariant ─────────────────────────────────────────────────────────────────────
/** Material that is not part of any supported structure. */
const OUTSIDE_GRAMMAR = ["not", "never", "approximately", "previously", "if needed", "vitamin d", "her niece", "instead", "41 μg/L", "or more", "(corrected)", "?"];
/** Every unit made by inserting one piece of outside material at one word boundary of `unit`. */
function mutations(unit: string, { beforeFinalStop }: { beforeFinalStop: boolean }): string[] {
  const body = beforeFinalStop ? unit.replace(/\.$/, "") : unit;
  const end = beforeFinalStop && unit.endsWith(".") ? "." : "";
  const words = body.split(" ");
  const out: string[] = [];
  for (let i = 0; i <= words.length; i++) {
    for (const piece of OUTSIDE_GRAMMAR) out.push([...words.slice(0, i), piece, ...words.slice(i)].join(" ") + end);
  }
  return out;
}

describe("C · invariant: a unit that does not match a supported structure can never become Verified", () => {
  it.each(MEDICATION_POSITIVE.filter(([, , s]) => !s.includes("\n")))("oral iron · every mutation of: %s", (_why, status, sentence) => {
    expect(medicationVerifies(sentence, status)).toBe(true);
    const verifiedMutations = mutations(sentence, { beforeFinalStop: true }).filter((m) => medicationVerifies(m, status));
    expect(verifiedMutations).toEqual([]);
  });

  it.each(FERRITIN_POSITIVE)("ferritin · every mutation of the line in: %s", (_why, body, excerpt, value, range, measuredOn) => {
    const at = body.indexOf(excerpt);
    const unit = /ng\/mL/.test(excerpt) ? "ng/mL" : "μg/L";
    expect(ferritinFact(body, excerpt, value, range, measuredOn, unit)).not.toBeNull();
    const verifiedMutations = mutations(excerpt, { beforeFinalStop: false }).filter((m) => {
      const mutated = body.map((l, i) => (i === at ? m : l));
      return ferritinFact(mutated, m, value, range, measuredOn, unit) !== null;
    });
    expect(verifiedMutations).toEqual([]);
  });

  it.each(HEADER_POSITIVE)("document date · every mutation of: %s", (_why, line, iso) => {
    const derived = mutations(line, { beforeFinalStop: false }).filter((m) => {
      const h = headerDocumentDate(headerWith(m));
      return h.ok && h.date === iso;
    });
    expect(derived).toEqual([]);
  });
});

// ─── The committed documents themselves ───────────────────────────────────────────────────
describe("A · the committed corpus verifies under the grammar", () => {
  const pdf = async (rel: string) => readPdfPages(new Uint8Array(await readFile(path.join(repo, rel))));

  it("every seed document and seed fact (the same checkers as `npm run verify:seed`)", async () => {
    const state = JSON.parse(await readFile(path.join(repo, "data/seed/state.json"), "utf8")) as TrustedState;
    const pagesByDocId = new Map<string, string[]>();
    for (const doc of state.documents) pagesByDocId.set(doc.id, await pdf(`data/seed/documents/${doc.file}`));
    expect(verifySeedState(state, pagesByDocId)).toEqual([]);
  });

  it("the live demo note: ferritin 32 μg/L (15–150) and oral iron Current, dated 25 Sep 2026", async () => {
    const r = verifyExtraction(await pdf("demo-files/follow-up-consultation-2026-09-25.pdf"), {
      document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
      labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: LIVE }],
      medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
    }, ctx);
    expect(r).toMatchObject({ status: "ok", documentDate: "2026-09-25", excludedCount: 0 });
    expect(verified(r)).toEqual([
      expect.objectContaining({ kind: "lab_measurement", value: 32, unit: "μg/L", refText: "15–150", measuredOn: "2026-09-25", source: { documentId: "doc-07", page: 2, verifiedExcerpt: LIVE } }),
      expect.objectContaining({ kind: "medication_status", status: "Current", documentedOn: "2026-09-25",
        source: { documentId: "doc-07", page: 1, verifiedExcerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." } }),
    ]);
  });

  it("the second follow-up test fixture: ferritin 41 μg/L and oral iron Stopped", async () => {
    const r = verifyExtraction(await pdf("tests/fixtures/second-follow-up-2026-10-02.pdf"), {
      document: { documentType: "Follow-up consultation note", documentDate: "2026-10-02", page: 1, excerpt: "Date of consultation 2 Oct 2026" },
      labMeasurements: [{ analyteName: "Ferritin", value: 41, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-10-02", page: 1, excerpt: "Ferritin on 2 Oct 2026: 41 μg/L (reference range 15–150 μg/L)." }],
      medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "stopped", page: 1, excerpt: "Oral iron (ferrous sulfate) was stopped." }],
    }, ctx);
    expect(verified(r).map((f) => (f.kind === "lab_measurement" ? f.value : f.kind === "medication_status" ? f.status : null))).toEqual([41, "Stopped"]);
  });
});
