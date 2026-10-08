/**
 * Dedupe inside one proposal: the AI may list the same fact twice. Semantically identical candidates collapse to
 * one approvable fact; genuinely distinct facts are kept.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProposedFact, TrustedState } from "@/lib/model/types";
import type { Extraction } from "@/lib/extraction/verify";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { apply } from "@/lib/engine/apply";
import { dedupe } from "@/lib/engine/dedupe";
import { ferritinSeries } from "@/lib/engine/derive";

const root = path.resolve(__dirname, "..");
const seed: TrustedState = JSON.parse(readFileSync(path.join(root, "data/seed/state.json"), "utf8"));
const demoPdf = new Uint8Array(readFileSync(path.join(root, "demo-files/follow-up-consultation-2026-09-25.pdf")));

const ferritin = {
  analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2,
  excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).",
};
const oralIron = { medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." };

async function proposalFor(extraction: Extraction) {
  const o = await runExtractionPipeline(demoPdf, seed, {
    extract: async () => ({ status: "ok", extraction, model: "stub" }),
    newProposalId: () => "00000000-0000-4000-8000-0000000000d1",
    now: () => "2026-09-26T10:00:00.000Z",
  });
  if (o.status !== "proposal") throw new Error(`expected a proposal, got ${o.status}`);
  return o.proposal;
}

describe("duplicate candidates within one proposal", () => {
  it("a repeated ferritin candidate and a repeated oral-iron candidate collapse to one fact each", async () => {
    const proposal = await proposalFor({
      document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
      labMeasurements: [ferritin, { ...ferritin }],
      medicationStatements: [oralIron, { ...oralIron, medicationName: "ferrous sulfate" }],
    });
    expect(proposal.facts.map((f) => f.kind)).toEqual(["lab_measurement", "medication_status"]);
    expect(new Set(proposal.facts.map((f) => f.id)).size).toBe(2);

    const after = apply(seed, proposal, proposal.facts.map((f) => f.id), "2026-09-26T10:05:00.000Z");
    expect(ferritinSeries(after).map((m) => m.value)).toEqual([11, 19.6, 32]);
    const statuses = (s: TrustedState) => s.facts.filter((f) => f.kind === "medication_status").length;
    expect(statuses(after)).toBe(statuses(seed) + 1);
    expect(after.documents).toHaveLength(seed.documents.length + 1);
  });

  it("genuinely distinct facts are never collapsed", () => {
    const base = { topic: "iron" as const, analyte: "ferritin" as const, unit: "μg/L", refLow: 15, refHigh: 150, refText: "15–150", measuredOn: "2026-09-25", review: "PROPOSED" as const };
    const src = { documentId: "doc-07", page: 2, verifiedExcerpt: "x" };
    const facts: ProposedFact[] = [
      { ...base, id: "doc-07-lab-1", kind: "lab_measurement", value: 32, source: src },
      { ...base, id: "doc-07-lab-2", kind: "lab_measurement", value: 41, source: src }, // another value
      { ...base, id: "doc-07-lab-3", kind: "lab_measurement", value: 32, measuredOn: "2026-09-26", source: src }, // another date
      { id: "doc-07-med-1", kind: "medication_status", episodeId: "ep-oral-iron", status: "Current", documentedOn: "2026-09-25", source: src, review: "PROPOSED" },
      { id: "doc-07-med-2", kind: "medication_status", episodeId: "ep-oral-iron", status: "Stopped", documentedOn: "2026-09-25", source: src, review: "PROPOSED" },
      { id: "doc-07-lab-4", kind: "lab_measurement", ...base, value: 32, source: src }, // exact repeat of lab-1
    ];
    const { fresh, duplicates } = dedupe([], facts);
    expect(fresh.map((f) => f.id)).toEqual(["doc-07-lab-1", "doc-07-lab-2", "doc-07-lab-3", "doc-07-med-1", "doc-07-med-2"]);
    expect(duplicates.map((f) => f.id)).toEqual(["doc-07-lab-4"]);
  });
});
