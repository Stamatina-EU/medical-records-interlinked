/**
 * First-record bootstrap — an EMPTY trusted state accepts its first supported document.
 * Product rule: empty history → first supported document → verified source fact → patient
 * approval → the first topic / measurement / medication episode is created. Existing history
 * is needed only for derived longitudinal consequences (changed since previous, latest, counts,
 * matching follow-up), never for accepting the first source fact.
 * The demo still starts from the synthetic seed; this proves the same pipeline works from empty.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TrustedState } from "@/lib/model/types";
import type { Extraction } from "@/lib/extraction/verify";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { apply, preview } from "@/lib/engine/apply";
import { derive } from "@/lib/engine/derive";
import { historyView } from "@/lib/view/history";
import { snapshotView } from "@/lib/view/snapshot";
import { composeDoctorSummary } from "@/lib/summary/compose";
import { reviewFactHeadline } from "@/lib/view/reviewFact";

const root = path.resolve(__dirname, "..");
const demoPdf = new Uint8Array(readFileSync(path.join(root, "demo-files/follow-up-consultation-2026-09-25.pdf")));

const empty: TrustedState = {
  version: 1,
  patient: { displayName: "New user (synthetic)" },
  seededAt: "2026-09-26T00:00:00.000Z",
  documents: [],
  episodes: [],
  facts: [],
  latestUpdate: null,
};

const extraction: Extraction = {
  document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
  labMeasurements: [
    { analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." },
  ],
  medicationStatements: [
    { medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." },
  ],
};

async function firstRecord() {
  const o = await runExtractionPipeline(demoPdf, empty, {
    extract: async () => ({ status: "ok", extraction, model: "stub" }),
    newProposalId: () => "00000000-0000-4000-8000-000000000001",
    now: () => "2026-09-26T10:00:00.000Z",
  });
  if (o.status !== "proposal") throw new Error(`expected a proposal from an empty history, got ${o.status}`);
  return o.proposal;
}

describe("empty trusted state → first supported document", () => {
  it("views of an empty history render without errors", () => {
    const claims = derive(empty);
    expect(claims).toEqual([]);
    expect(() => snapshotView(empty, claims)).not.toThrow();
    expect(() => historyView(empty, claims, "iron")).not.toThrow();
    expect(composeDoctorSummary(empty, claims).sections).toEqual([]);
  });

  it("both supported facts verify with no existing episode, measurement or document", async () => {
    const proposal = await firstRecord();
    expect(proposal.document.id).toBe("doc-01");
    expect(proposal.facts.map((f) => [f.kind, f.kind === "lab_measurement" ? f.value : f.status])).toEqual([
      ["lab_measurement", 32],
      ["medication_status", "Current"],
    ]);
    expect(proposal.excludedCount).toBe(0);
  });

  it("approval creates the first document, measurement and medication episode", async () => {
    const proposal = await firstRecord();
    const after = apply(empty, proposal, proposal.facts.map((f) => f.id), "2026-09-26T10:05:00.000Z");
    expect(after.documents.map((d) => d.id)).toEqual(["doc-01"]);
    expect(after.episodes).toEqual([{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }]);
    expect(after.facts.map((f) => f.review)).toEqual(["APPROVED", "APPROVED"]);
    expect(after.latestUpdate?.approvedFactIds).toHaveLength(2);

    const claims = derive(after);
    const iron = historyView(after, claims, "iron");
    if (iron.topic !== "iron") throw new Error("wrong topic");
    expect(iron.measurements.map((m) => m.fact.value)).toEqual([32]);
    expect(iron.treatment[0].events.map((e) => e.fact.status)).toEqual(["Current"]);
    expect(() => snapshotView(after, claims)).not.toThrow();
  });

  it("approving only the medication still creates its episode; approving only the lab creates none", async () => {
    const proposal = await firstRecord();
    const [lab, med] = proposal.facts;
    expect(apply(empty, proposal, [med.id], "2026-09-26T10:05:00.000Z").episodes.map((e) => e.id)).toEqual(["ep-oral-iron"]);
    expect(apply(empty, proposal, [lab.id], "2026-09-26T10:05:00.000Z").episodes).toEqual([]);
  });

  it("the preview names what the first approval adds", async () => {
    const proposal = await firstRecord();
    const lines = preview(empty, proposal, proposal.facts.map((f) => f.id)).map((l) => l.text);
    expect(lines).toContain("New ferritin measurement added · 32 μg/L · 25 Sep 2026");
    expect(lines).toContain("Oral iron marked Ongoing · documented 25 Sep 2026");
  });

  it("the review names the first medication 'Oral iron' before any episode exists, and the same after approval", async () => {
    const proposal = await firstRecord();
    const [lab, med] = proposal.facts;
    expect(empty.episodes).toEqual([]);
    expect(reviewFactHeadline(med, empty)).toEqual({ label: "Oral iron", value: "Ongoing · documented 25 Sep 2026" });
    expect(reviewFactHeadline(lab, empty).label).toBe("Ferritin");
    // after approval the record's own episode carries the name; review and record agree
    const after = apply(empty, proposal, proposal.facts.map((f) => f.id), "2026-09-26T10:05:00.000Z");
    expect(after.episodes.map((e) => e.name)).toEqual(["Oral iron (ferrous sulfate)"]);
    expect(reviewFactHeadline(med, after).label).toBe("Oral iron");
  });

  it("a medication outside the supported catalogue is never given a name it doesn't have", async () => {
    const proposal = await firstRecord();
    const med = proposal.facts[1];
    if (med.kind !== "medication_status") throw new Error("expected the medication fact");
    expect(reviewFactHeadline({ ...med, episodeId: "ep-unknown" }, empty).label).toBe("Medication");
  });

  it("longitudinal consequences wait for history: no 'changed since previous', no follow-up match", async () => {
    const proposal = await firstRecord();
    const after = apply(empty, proposal, proposal.facts.map((f) => f.id), "2026-09-26T10:05:00.000Z");
    const kinds = derive(after).map((c) => c.kind);
    expect(kinds).toContain("range_status"); // compares the result only with its own supplied range
    expect(kinds).not.toContain("changed_since_previous");
    expect(kinds).not.toContain("previously_outside_range");
    expect(kinds).not.toContain("followup_match");
  });

  it("the Doctor Summary bootstraps too, with a single measurement and a direct medication status", async () => {
    const proposal = await firstRecord();
    const after = apply(empty, proposal, proposal.facts.map((f) => f.id), "2026-09-26T10:05:00.000Z");
    const s = composeDoctorSummary(after, derive(after));
    const picture = s.sections.find((x) => x.id === "picture")!.statements;
    expect(picture.map((st) => [st.derived ? "DERIVED" : "direct", st.text])).toEqual([
      ["DERIVED", "One ferritin measurement is documented: 32 μg/L on 25 Sep 2026."],
      ["direct", "Oral iron (ferrous sulfate) is documented as ongoing."],
    ]);
    expect(s.sections.some((x) => x.id === "history")).toBe(false); // a history line needs ≥ 2 results
    expect(s.latestSourceDate).toBe("2026-09-25");
  });
});
