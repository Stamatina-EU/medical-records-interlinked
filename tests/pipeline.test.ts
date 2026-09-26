/**
 * Extraction pipeline outcomes — each Add record result comes from what the pipeline steps
 * actually returned (`lib/extraction/pipeline.ts`). Uses the real synthetic demo PDF and a stub
 * in place of the AI call. Also checks that no outcome carries document text.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TrustedState } from "@/lib/model/types";
import type { Extraction } from "@/lib/extraction/verify";
import { ExtractionUnavailableError, type ExtractionCallResult } from "@/lib/extraction/extract";
import { MAX_BYTES, outcomeLogLine, runExtractionPipeline, type PipelineOutcome } from "@/lib/extraction/pipeline";
import { apply } from "@/lib/engine/apply";

const root = path.resolve(__dirname, "..");
const seed: TrustedState = JSON.parse(readFileSync(path.join(root, "data/seed/state.json"), "utf8"));
const demoPdf = new Uint8Array(readFileSync(path.join(root, "demo-files/follow-up-consultation-2026-09-25.pdf")));

/** A minimal valid one-page PDF with an empty content stream: no text layer, like a scan. */
function blankPdf(): Uint8Array {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const good: Extraction = {
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
    { medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." },
  ],
};

const ok = (extraction: Extraction): ExtractionCallResult => ({ status: "ok", extraction, model: "stub" });
const run = (bytes: Uint8Array, extract: (p: string[]) => Promise<ExtractionCallResult>, state: TrustedState = seed) =>
  runExtractionPipeline(bytes, state, { extract, newProposalId: () => "00000000-0000-4000-8000-000000000000", now: () => "2026-09-26T10:00:00.000Z" });

// Text that appears in the demo document, plus a marker only the stub "model" produces.
const DOCUMENT_TEXT = ["Alex Rowan", "ferrous sulfate", "continues to take", "32 μg/L", "Elm Street", "ZZ-PRIVATE-MARKER"];
function expectContentFree(o: PipelineOutcome) {
  const exposed = JSON.stringify(o) + outcomeLogLine(o);
  for (const t of DOCUMENT_TEXT) expect(exposed).not.toContain(t);
}

describe("1. PDF has no usable text layer", () => {
  it("returns no_text and never calls the AI", async () => {
    const extract = vi.fn();
    const o = await run(blankPdf(), extract);
    expect(o).toEqual({ status: "no_text" });
    expect(extract).not.toHaveBeenCalled();
  });

  it("files that can't be opened as a PDF are their own state, not 'no text'", async () => {
    const extract = vi.fn();
    expect(await run(new TextEncoder().encode("GIF89a not a pdf"), extract)).toEqual({ status: "unsupported_file", code: "not_pdf" });
    expect(await run(new TextEncoder().encode("%PDF-1.4 damaged"), extract)).toEqual({ status: "unsupported_file", code: "damaged_pdf" });
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(new TextEncoder().encode("%PDF-"));
    expect(await run(big, extract)).toEqual({ status: "unsupported_file", code: "too_large" });
    expect(extract).not.toHaveBeenCalled();
  });
});

// A proposed supported fact that fails deterministic verification (wrong value for the source line).
const failingLab = { ...good.labMeasurements[0], value: 99 };
const failingMed = { ...good.medicationStatements[0], status: "completed" as const }; // the note says "continues to take"

describe("2A. text read, no supported fact type proposed", () => {
  it("returns no_supported_facts — only when the model proposed nothing supported", async () => {
    const o = await run(demoPdf, async () => ok({ ...good, labMeasurements: [], medicationStatements: [] }));
    expect(o).toEqual({ status: "no_supported_facts", code: "no_candidate_facts" });
  });

  it("an unverifiable document date does not turn 'nothing proposed' into 'not verified'", async () => {
    const o = await run(demoPdf, async () =>
      ok({ document: { ...good.document, excerpt: "not in the document" }, labMeasurements: [], medicationStatements: [] }),
    );
    expect(o).toEqual({ status: "no_supported_facts", code: "no_candidate_facts" });
  });
});

describe("2A. an unrelated document never reaches 'none verified'", () => {
  // A synthetic imaging report that names neither ferritin nor oral iron stands in for an
  // unrelated real lab report (the private document itself is never used in tests).
  const unrelatedPdf = new Uint8Array(readFileSync(path.join(root, "data/seed/documents/d2-imaging-report-2025-09-10.pdf")));
  const otherTest = { analyteName: "Albumin", value: 41, unit: "g/L", referenceRangeText: "35–50 g/L", measuredOn: "2025-09-10", page: 1, excerpt: "Albumin 41 g/L 35–50" };

  it("other lab tests only → no_supported_facts, even with an unverifiable document date", async () => {
    const o = await run(unrelatedPdf, async () =>
      ok({ document: { documentType: "Lab report", documentDate: "2025-09-10", page: 1, excerpt: "not in the document" }, labMeasurements: [otherTest], medicationStatements: [] }),
    );
    expect(o).toEqual({ status: "no_supported_facts", code: "no_candidate_facts" });
  });

  it("a false-positive 'ferritin' / 'oral iron' candidate in a document that never names them → no_supported_facts", async () => {
    const o = await run(unrelatedPdf, async () =>
      ok({
        document: { documentType: "Lab report", documentDate: "2025-09-10", page: 1, excerpt: "not in the document" },
        labMeasurements: [otherTest, { ...good.labMeasurements[0], measuredOn: "2025-09-10" }],
        medicationStatements: [good.medicationStatements[0]],
      }),
    );
    expect(o).toEqual({ status: "no_supported_facts", code: "no_candidate_facts" });
  });

  it("other tests proposed alongside the demo note's real facts are ignored, not counted as left out", async () => {
    const o = await run(demoPdf, async () => ok({ ...good, labMeasurements: [...good.labMeasurements, otherTest] }));
    if (o.status !== "proposal") throw new Error(`expected a proposal, got ${o.status}`);
    expect(o.proposal.facts).toHaveLength(2);
    expect(o.proposal.excludedCount).toBe(0);
  });
});

describe("2B. supported facts proposed, none verified", () => {
  it("one supported fact that fails verification → no_verified_facts, not no_supported_facts", async () => {
    const o = await run(demoPdf, async () => ok({ ...good, labMeasurements: [failingLab], medicationStatements: [] }));
    expect(o).toEqual({ status: "no_verified_facts", code: "none_verified" });
  });

  it("every proposed fact fails (lab and medication) → no_verified_facts", async () => {
    const o = await run(demoPdf, async () =>
      ok({
        ...good,
        labMeasurements: [failingLab, { ...good.labMeasurements[0], analyteName: "ZZ-PRIVATE-MARKER", value: 5.4 }],
        medicationStatements: [failingMed, { ...good.medicationStatements[0], excerpt: "ZZ-PRIVATE-MARKER is taken daily." }],
      }),
    );
    expect(o).toEqual({ status: "no_verified_facts", code: "none_verified" });
    expectContentFree(o);
  });

  it("facts proposed but the document date can't be verified → no_verified_facts (facts can't be dated)", async () => {
    const o = await run(demoPdf, async () => ok({ ...good, document: { ...good.document, excerpt: "ZZ-PRIVATE-MARKER 25 Sep 2026" } }));
    expect(o).toEqual({ status: "no_verified_facts", code: "document_date_unverified" });
    expectContentFree(o);
  });

  it("if even one proposed fact verifies, it is a proposal — neither failure state", async () => {
    const o = await run(demoPdf, async () => ok({ ...good, labMeasurements: [failingLab] }));
    expect(o.status).toBe("proposal");
    if (o.status === "proposal") expect(o.proposal.excludedCount).toBe(1);
  });
});

describe("2A and 2B never collapse into one another", () => {
  const cases: [string, Extraction, PipelineOutcome["status"]][] = [
    ["nothing proposed", { ...good, labMeasurements: [], medicationStatements: [] }, "no_supported_facts"],
    ["one failing lab", { ...good, labMeasurements: [failingLab], medicationStatements: [] }, "no_verified_facts"],
    ["one failing medication", { ...good, labMeasurements: [], medicationStatements: [failingMed] }, "no_verified_facts"],
    ["failing lab + failing medication", { ...good, labMeasurements: [failingLab], medicationStatements: [failingMed] }, "no_verified_facts"],
  ];
  it.each(cases)("%s → %s", async (_label, extraction, expected) => {
    const o = await run(demoPdf, async () => ok(extraction));
    expect(o.status).toBe(expected);
  });

  it("the two states have different statuses, codes and log lines", async () => {
    const a = await run(demoPdf, async () => ok(cases[0][1]));
    const b = await run(demoPdf, async () => ok(cases[1][1]));
    expect(a.status).not.toBe(b.status);
    expect(outcomeLogLine(a)).toBe("[extract] no_supported_facts: no_candidate_facts");
    expect(outcomeLogLine(b)).toBe("[extract] no_verified_facts: none_verified");
  });
});

describe("3. AI / API / structured-output failure", () => {
  it("service unreachable → processing_failed, retryable", async () => {
    const o = await run(demoPdf, async () => {
      throw new ExtractionUnavailableError("APIConnectionError ZZ-PRIVATE-MARKER");
    });
    expect(o).toEqual({ status: "processing_failed", code: "ai_unavailable", retryable: true });
    expectContentFree(o);
  });

  it.each([
    ["incomplete", "ai_incomplete", true],
    ["invalid_output", "ai_invalid_output", true],
    ["refused", "ai_refused", false],
  ] as const)("model answer %s → processing_failed (%s), retryable=%s", async (code, expected, retryable) => {
    const o = await run(demoPdf, async () => ({ status: "unusable", code, reason: "ZZ-PRIVATE-MARKER", model: "stub" }));
    expect(o).toEqual({ status: "processing_failed", code: expected, retryable });
    expectContentFree(o);
  });
});

describe("4. valid extraction, nothing new", () => {
  it("first time → a proposal; the same record again after approval → no_changes", async () => {
    const first = await run(demoPdf, async () => ok(good));
    if (first.status !== "proposal") throw new Error(`expected a proposal, got ${first.status}`);
    expect(first.proposal.facts.map((f) => f.kind)).toEqual(["lab_measurement", "medication_status"]);

    const approved = apply(seed, first.proposal, first.proposal.facts.map((f) => f.id), "2026-09-26T10:05:00.000Z");
    const again = await run(demoPdf, async () => ok(good), approved);
    expect(again).toEqual({ status: "no_changes" });
  });
});

describe("outcomes never expose document contents", () => {
  it("log lines carry status and reason code only", () => {
    expect(outcomeLogLine({ status: "no_text" })).toBe("[extract] no_text");
    expect(outcomeLogLine({ status: "no_supported_facts", code: "no_candidate_facts" })).toBe("[extract] no_supported_facts: no_candidate_facts");
    expect(outcomeLogLine({ status: "no_verified_facts", code: "none_verified" })).toBe("[extract] no_verified_facts: none_verified");
    expect(outcomeLogLine({ status: "processing_failed", code: "ai_unavailable", retryable: true })).toBe("[extract] processing_failed: ai_unavailable");
  });
});
