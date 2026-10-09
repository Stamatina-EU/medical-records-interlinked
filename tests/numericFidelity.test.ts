/**
 * Numeric fidelity (final grammar audit). Unicode compatibility normalization (NFKC) can change a number's meaning —
 * it turns "10³" into "103", "３２" into "32", "③②" into "32". Authoritative verification therefore never applies it:
 * locating the excerpt, matching the grammar and comparing the claim all use the source-faithful profile, so a
 * numeric notation outside the declared grammar stays outside it. Every case runs the real `verifyExtraction` path.
 */
import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { locateExcerpt, verifyExtraction, verifySeedState, type Extraction } from "@/lib/extraction/verify";
import { readPdfPages } from "@/lib/extraction/pdfText";
import { findOriginalRange, normalizeSource } from "@/lib/text/normalize";
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
const reasons = (r: ReturnType<typeof run>) => (r.status === "ok" ? r.exclusions.map((e) => e.reason) : [r.reason]);
/** A ferritin claim against one RESULTS line; the medication control keeps the extraction usable so reasons are visible. */
const ferritin = (line: string, excerpt: string, value: number, unit = "ng/mL", referenceRangeText: string | null = null, measuredOn = "2026-09-25") =>
  run([page("MEDICATION HISTORY", "Oral iron was stopped.", "RESULTS", line)], {
    labMeasurements: [{ analyteName: "Ferritin", value, unit, referenceRangeText, measuredOn, page: 1, excerpt }],
    medicationStatements: [{ medicationName: "oral iron", status: "stopped", page: 1, excerpt: "Oral iron was stopped." }],
  });
const labVerified = (r: ReturnType<typeof run>) => verified(r).filter((f) => f.kind === "lab_measurement");

describe("1–2 · the audit reproduction: '10³' is neither 103 nor 1000", () => {
  const line = "Ferritin 10³ ng/mL (reference range 15-150 ng/mL).";

  it("NFKC really would read it as 103 (the defect this guards against)", () => {
    expect(line.normalize("NFKC")).toContain("103 ng/mL");
  });

  it.each([[103], [1000], [10]])("the verbatim source excerpt does not verify as %s", (value) => {
    const r = ferritin(line, line, value, "ng/mL", "15-150");
    expect(labVerified(r)).toEqual([]);
    expect(reasons(r)).toEqual([expect.stringMatching(/not a supported ferritin result/)]);
  });

  it("an ASCII excerpt '103' is not located on the '10³' source at all", () => {
    const r = ferritin(line, "Ferritin 103 ng/mL (reference range 15-150 ng/mL).", 103, "ng/mL", "15-150");
    expect(labVerified(r)).toEqual([]);
    expect(reasons(r)).toEqual([expect.stringMatching(/excerpt not found/)]);
  });

  it("excerpt location cannot map an ASCII proposal onto a numerically different source form (search matching still could)", () => {
    const pages = [page("RESULTS", line)];
    expect(locateExcerpt(pages, 1, "Ferritin 103 ng/mL").ok).toBe(false);
    expect(findOriginalRange(pages[0], "Ferritin 103 ng/mL", "search")).not.toBeNull(); // why the profiles are separate
  });
});

describe("3 · no Unicode numeric form becomes a supported number through normalization", () => {
  // [notation, source line, the number its NFKC folding would yield]
  const FORMS: [string, string, number][] = [
    ["superscript digits", "Ferritin 3² μg/L.", 32],
    ["subscript digits", "Ferritin 3₂ μg/L.", 32],
    ["circled digits", "Ferritin ③② μg/L.", 32],
    ["mathematical bold digits", "Ferritin 𝟑𝟐 μg/L.", 32],
    ["full-width digits", "Ferritin ３２ μg/L.", 32],
    ["a full-width full stop as the decimal point", "Ferritin 19．6 μg/L.", 19.6],
    ["a one-dot leader as the decimal point", "Ferritin 19․6 μg/L.", 19.6],
    ["a vulgar fraction", "Ferritin 32½ μg/L.", 32.5],
    ["scientific notation with a superscript exponent", "Ferritin 3.2×10¹ μg/L.", 32],
  ];

  it.each(FORMS)("%s: neither the source wording nor its ASCII folding verifies", (_form, line, value) => {
    const folded = line.normalize("NFKC");
    expect(folded).not.toBe(line); // the notation really is a compatibility form
    for (const excerpt of [line, folded]) {
      for (const v of [value, Math.floor(value)]) expect(labVerified(ferritin(line, excerpt, v, "μg/L"))).toEqual([]);
    }
    expect(normalizeSource(line)).toBe(line.toLowerCase()); // the authoritative profile leaves the notation as it is
  });

  it("other notations outside the grammar stay outside it: non-ASCII digit systems and ASCII scientific notation", () => {
    expect(labVerified(ferritin("Ferritin ٣٢ μg/L.", "Ferritin ٣٢ μg/L.", 32, "μg/L"))).toEqual([]);
    expect(labVerified(ferritin("Ferritin 3.2e1 μg/L.", "Ferritin 3.2e1 μg/L.", 32, "μg/L"))).toEqual([]);
    expect(labVerified(ferritin("Ferritin 3.2e1 μg/L.", "Ferritin 3.2e1 μg/L.", 3.2, "μg/L"))).toEqual([]);
  });

  it.each([
    ["a minus sign", "Ferritin 32 μg/L (reference range 15−150 μg/L)."],
    ["a full-width hyphen-minus", "Ferritin 32 μg/L (reference range 15－150 μg/L)."],
    ["a small hyphen-minus", "Ferritin 32 μg/L (reference range 15﹣150 μg/L)."],
    ["a superscript in the range", "Ferritin 32 μg/L (reference range 15–15⁰ μg/L)."],
  ])("a compatibility sign or digit in the range (%s) never becomes the supported range", (_why, line) => {
    expect(labVerified(ferritin(line, line, 32, "μg/L", "15-150"))).toEqual([]);
    expect(labVerified(ferritin(line, line.normalize("NFKC").replace(/[−－﹣]/g, "-"), 32, "μg/L", "15-150"))).toEqual([]);
  });

  it("a compatibility digit in a result's date never becomes the supported date", () => {
    const line = "Ferritin on 2⁵ Sep 2026: 32 μg/L.";
    expect(labVerified(ferritin(line, line, 32, "μg/L", null, "2026-09-25"))).toEqual([]);
  });

  it("a compatibility digit in the header date never becomes the document date", () => {
    const pages = [["Elm Street Primary Care", "Date of consultation 2⁵ Sep 2026", "MEDICATION HISTORY", "Oral iron was stopped."].join("\n")];
    const r = verifyExtraction(pages, {
      document: { documentType: "Note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 2⁵ Sep 2026" },
      labMeasurements: [], medicationStatements: [{ medicationName: "oral iron", status: "stopped", page: 1, excerpt: "Oral iron was stopped." }],
    }, ctx);
    expect(r).toMatchObject({ status: "unusable", code: "document_date_unverified" });
  });

  it("compatibility forms in a medication dose or a name do not become the supported sentence", () => {
    const med = (sentence: string, status: string) =>
      verified(run([page("MEDICATION HISTORY", sentence)], { medicationStatements: [{ medicationName: "oral iron", status, page: 1, excerpt: sentence }] }));
    expect(med("Prescribed: ferrous sulfate ２００ mg tablets.", "prescribed")).toEqual([]);
    expect(med("Prescribed: ferrous sulfate 2⁰⁰ mg tablets.", "prescribed")).toEqual([]);
    expect(med("ＯＲＡＬ ＩＲＯＮ was stopped.", "stopped")).toEqual([]);
    expect(labVerified(ferritin("ＦＥＲＲＩＴＩＮ 32 μg/L.", "ＦＥＲＲＩＴＩＮ 32 μg/L.", 32, "μg/L"))).toEqual([]);
  });
});

describe("4–5 · committed values still verify, with source-faithful excerpts", () => {
  const pdf = async (rel: string) => readPdfPages(new Uint8Array(await readFile(path.join(repo, rel))));

  it("the seed values 11 and 19.6 with ranges 30–400 and 15–150 (every seed document and fact)", async () => {
    const state = JSON.parse(await readFile(path.join(repo, "data/seed/state.json"), "utf8")) as TrustedState;
    const pagesByDocId = new Map<string, string[]>();
    for (const doc of state.documents) pagesByDocId.set(doc.id, await pdf(`data/seed/documents/${doc.file}`));
    expect(verifySeedState(state, pagesByDocId)).toEqual([]);
    const labs = state.facts.filter((f) => f.kind === "lab_measurement").map((f) => (f.kind === "lab_measurement" ? [f.value, f.refText] : null));
    expect(labs).toEqual([[11, "30–400"], [19.6, "15–150"]]);
  });

  it("the live note: 32 μg/L, range 15–150, stored with the page's exact wording even from a sloppy model excerpt", async () => {
    const pages = await pdf("demo-files/follow-up-consultation-2026-09-25.pdf");
    const exact = "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).";
    // micro sign for mu, hyphen for the en dash, lower case, doubled space: meaning-preserving differences only
    const sloppy = "ferritin on 25 sep 2026:  32 µg/l (reference range 15-150 µg/l).";
    const r = verifyExtraction(pages, {
      document: docClaim,
      labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "µg/L", referenceRangeText: "15-150 µg/L", measuredOn: "2026-09-25", page: 2, excerpt: sloppy }],
      medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
    }, ctx);
    expect(verified(r)).toEqual([
      expect.objectContaining({ kind: "lab_measurement", value: 32, unit: "μg/L", refLow: 15, refHigh: 150, refText: "15–150", source: { documentId: "doc-07", page: 2, verifiedExcerpt: exact } }),
      expect.objectContaining({ kind: "medication_status", status: "Current" }),
    ]);
    expect(pages[1]).toContain(exact); // the stored excerpt is the page substring, character for character
  });

  it("the authoritative path performs no Unicode compatibility normalization at all", async () => {
    const pages = await pdf("demo-files/follow-up-consultation-2026-09-25.pdf");
    const spy = vi.spyOn(String.prototype, "normalize");
    try {
      verifyExtraction(pages, {
        document: docClaim,
        labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }],
        medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
      }, ctx);
      expect(spy.mock.calls.filter(([form]) => form === "NFKC" || form === "NFKD")).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
