/**
 * Record claims and added-document metadata.
 * - Medical counts and "latest" selections are Derived claims that expose every input
 *   (`lib/engine/recordClaims.ts`), shared by Home and the Doctor Summary without changing its copy.
 * - Added-document metadata comes only from source text (`lib/extraction/documentMeta.ts`).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Proposal, TrustedState } from "@/lib/model/types";
import { derive } from "@/lib/engine/derive";
import { apply } from "@/lib/engine/apply";
import { snapshotView } from "@/lib/view/snapshot";
import { composeDoctorSummary } from "@/lib/summary/compose";
import { recordClaims } from "@/lib/engine/recordClaims";
import { addedDocumentRecord } from "@/lib/extraction/documentMeta";

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
const ids = (s: TrustedState, kind: string) => s.facts.filter((f) => f.kind === kind).map((f) => f.id);

describe("Home's counts and 'latest' selections are Derived claims with every input", () => {
  it.each([
    ["seed", seed],
    ["after update", after],
  ] as const)("%s: every Latest row points at a record claim that lists all of its inputs", (_label, state) => {
    const claims = new Map(recordClaims(state).map((c) => [c.key, c]));
    const groups = snapshotView(state, derive(state)).latestGroups;
    expect(groups.map((g) => g.kind)).toEqual(["measurements", "treatment", "imaging"]);
    const expectedInputs = { measurements: ids(state, "lab_measurement"), treatment: ids(state, "medication_status"), imaging: ids(state, "imaging_exam") };
    for (const g of groups) {
      const c = claims.get(g.countClaimKey);
      expect(c, g.kind).toBeDefined();
      expect(new Set(c!.inputFactIds)).toEqual(new Set(expectedInputs[g.kind]));
      // the row's latest item is among the claim's inputs
      const latestId = g.kind === "measurements" ? g.latestFactId : g.kind === "treatment" ? g.latestEventId : g.latestExamId;
      expect(c!.inputFactIds).toContain(latestId);
    }
  });

  it("claim headlines state the count and the latest item", () => {
    const text = (s: TrustedState) => recordClaims(s).map((c) => c.text);
    expect(text(seed)).toEqual([
      "2 ferritin measurements documented · latest 19.6 μg/L on 27 Jan 2026",
      "1 treatment documented · latest status: Oral iron · Prescribed",
      "2 thyroid ultrasounds documented · latest 12 Mar 2026",
      "Latest documented thyroid ultrasound · 12 Mar 2026",
    ]);
    expect(text(after).slice(0, 2)).toEqual([
      "3 ferritin measurements documented · latest 32 μg/L on 25 Sep 2026",
      "1 treatment documented · latest status: Oral iron · Ongoing",
    ]);
  });

  it("the shared layer leaves the Doctor Summary's drawer headlines exactly as approved", () => {
    const headlines = composeDoctorSummary(after, derive(after)).claims.map((c) => c.text);
    expect(headlines).toEqual(["3 ferritin measurements documented · latest 32 μg/L on 25 Sep 2026", "Latest documented thyroid ultrasound · 12 Mar 2026"]);
  });

  it("an empty record has no record claims", () => {
    const empty: TrustedState = { ...seed, documents: [], episodes: [], facts: [], latestUpdate: null };
    expect(recordClaims(empty)).toEqual([]);
  });
});

describe("added-document metadata comes only from source text", () => {
  const pages = ["Elm Street Primary Care\nFOLLOW-UP CONSULTATION NOTE\nDate of consultation 25 Sep 2026", "LABORATORY REPORT\nSERUM PROTEIN ELECTROPHORESIS"];

  it("the model's type is found in the text → title cut from the text, type classified from that text (demo unchanged)", () => {
    const d = addedDocumentRecord(pages, "Follow-up consultation note", "2026-09-25", "doc-07");
    expect([d.title, d.documentType, d.date, d.issuer]).toEqual(["Follow-up Consultation Note", "consultation_note", "2026-09-25", ""]);
  });

  it("found but not a known type → 'other', never a guessed consultation note", () => {
    const d = addedDocumentRecord(pages, "Serum protein electrophoresis", "2026-09-25", "doc-07");
    expect([d.title, d.documentType]).toEqual(["Serum Protein Electrophoresis", "other"]);
  });

  it("not found in the text → the AI suggestion is ignored: 'Added document', type 'other'", () => {
    const d = addedDocumentRecord(pages, "Discharge summary", "2026-09-25", "doc-07");
    expect([d.title, d.documentType, d.date]).toEqual(["Added document", "other", "2026-09-25"]);
    expect(addedDocumentRecord(pages, "", "2026-09-25", "doc-07").title).toBe("Added document");
  });

  it("a found, known type is still classified from the verified text", () => {
    expect(addedDocumentRecord(pages, "Laboratory report", "2026-09-25", "doc-07").documentType).toBe("lab_report");
  });

  it("'other' documents get neutral labels on Home", () => {
    const doc = addedDocumentRecord(pages, "Discharge summary", "2026-09-25", "doc-07");
    const state = apply(seed, { ...proposal, document: doc }, ["doc-07-lab-1"], "2026-09-26T10:05:00.000Z");
    const labels = snapshotView(state, derive(state)).summary.documentTypes.map((t) => t.label);
    expect(labels).toContain("other document");
  });
});
