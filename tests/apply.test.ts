/** The kernel: preview, dependency rules, apply, What changed, approval validation. `spec.md > Engine`. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Proposal, TrustedState } from "@/lib/model/types";
import { apply, preview, validateApproval } from "@/lib/engine/apply";
import { changesSummary } from "@/lib/engine/changes";
import { derive, latestMedicationStatus } from "@/lib/engine/derive";
import { addedDocumentRecord, nextDocumentId } from "@/lib/extraction/documentMeta";

const seed: TrustedState = JSON.parse(readFileSync(path.resolve(__dirname, "../data/seed/state.json"), "utf8"));

const livePages = [
  "Elm Street Primary Care\nGeneral practice (fictional) FOLLOW-UP CONSULTATION NOTE\nPatient Alex Rowan (fictional)\nDate of consultation 25 Sep 2026\nMEDICATION HISTORY\nThe patient continues to take oral iron (ferrous sulfate) once daily.",
  "RESULTS\nFerritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).",
];

const proposal: Proposal = {
  proposalId: "00000000-0000-4000-8000-000000000000",
  document: addedDocumentRecord(livePages, "Follow-up consultation note", "2026-09-25", nextDocumentId(seed)),
  excludedCount: 0,
  createdAt: "2026-09-26T10:00:00.000Z",
  facts: [
    {
      id: "doc-07-lab-1",
      kind: "lab_measurement",
      topic: "iron",
      analyte: "ferritin",
      value: 32,
      unit: "μg/L",
      refLow: 15,
      refHigh: 150,
      refText: "15–150",
      measuredOn: "2026-09-25",
      source: { documentId: "doc-07", page: 2, verifiedExcerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." },
      review: "PROPOSED",
    },
    {
      id: "doc-07-med-1",
      kind: "medication_status",
      episodeId: "ep-oral-iron",
      status: "Current",
      documentedOn: "2026-09-25",
      source: {
        documentId: "doc-07",
        page: 1,
        verifiedExcerpt: "The patient continues to take oral iron (ferrous sulfate) once daily.",
      },
      review: "PROPOSED",
    },
  ],
};

const texts = (lines: { text: string }[]) => lines.map((l) => l.text);
const LAB = "New ferritin measurement added · 32 μg/L · 25 Sep 2026";
const MATCH = "Matching follow-up result found · 25 Sep 2026";
const MED = "Oral iron marked Ongoing · documented 25 Sep 2026";

describe("preview — patients approve evidence, code derives consequences", () => {
  it("with everything approved, previews the measurement, the follow-up match and the medication status", () => {
    expect(texts(preview(seed, proposal, ["doc-07-lab-1", "doc-07-med-1"]))).toEqual([LAB, MATCH, MED]);
  });

  it("rejecting the ferritin fact removes the follow-up consequence (it cannot survive independently)", () => {
    expect(texts(preview(seed, proposal, ["doc-07-med-1"]))).toEqual([MED]);
  });

  it("rejecting the medication fact leaves the medication status unchanged", () => {
    expect(texts(preview(seed, proposal, ["doc-07-lab-1"]))).toEqual([LAB, MATCH]);
  });

  it("with everything rejected there is nothing to update", () => {
    expect(preview(seed, proposal, [])).toEqual([]);
  });
});

describe("apply — only approved source facts are written", () => {
  const after = apply(seed, proposal, ["doc-07-lab-1", "doc-07-med-1"], "2026-09-26T10:05:00.000Z");

  it("writes the facts as APPROVED source facts, adds the document and records the latest update", () => {
    expect(after.facts.filter((f) => f.id.startsWith("doc-07")).map((f) => f.review)).toEqual(["APPROVED", "APPROVED"]);
    expect(after.documents.at(-1)).toMatchObject({ id: "doc-07", origin: "added", title: "Follow-up Consultation Note" });
    expect(after.latestUpdate).toMatchObject({
      documentId: "doc-07",
      approvedFactIds: ["doc-07-lab-1", "doc-07-med-1"],
      approvedAt: "2026-09-26T10:05:00.000Z",
    });
    expect(after.latestUpdate!.affected).toEqual(expect.arrayContaining(["doc-07-lab-1", "doc-07-med-1", "followup-match:fu-ferritin-2026-02-03"]));
  });

  it("keeps the verifiedExcerpt exactly as the source page text", () => {
    const lab = after.facts.find((f) => f.id === "doc-07-lab-1")!;
    expect(lab.source.verifiedExcerpt).toBe("Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).");
  });

  it("What changed, derived from the saved state, matches what the preview promised", () => {
    expect(texts(changesSummary(after))).toEqual([LAB, MATCH, MED]);
  });

  it("derived state updates deterministically", () => {
    expect(latestMedicationStatus(after, "ep-oral-iron")?.status).toBe("Current");
    const keys = derive(after).map((c) => c.key);
    expect(keys).toContain("followup-match:fu-ferritin-2026-02-03");
    expect(keys).not.toContain("followup-no-later:fu-ferritin-2026-02-03");
  });

  it("applying with the ferritin fact rejected: medication only, no follow-up match", () => {
    const medOnly = apply(seed, proposal, ["doc-07-med-1"], "2026-09-26T10:05:00.000Z");
    expect(medOnly.facts.some((f) => f.id === "doc-07-lab-1")).toBe(false);
    expect(derive(medOnly).some((c) => c.key.startsWith("followup-match:"))).toBe(false);
    expect(texts(changesSummary(medOnly))).toEqual([MED]);
  });

  it("applying nothing changes nothing", () => {
    expect(apply(seed, proposal, [], "2026-09-26T10:05:00.000Z")).toBe(seed);
  });

  it("the seed state itself has no What changed", () => {
    expect(changesSummary(seed)).toEqual([]);
  });
});

describe("validateApproval — the server trusts ids, never fact contents", () => {
  it("accepts known ids", () => {
    const r = validateApproval(proposal, ["doc-07-lab-1"]);
    expect(r.ok && r.approved.map((f) => f.id)).toEqual(["doc-07-lab-1"]);
  });
  it("rejects unknown ids", () => {
    expect(validateApproval(proposal, ["doc-07-lab-1", "forged-fact"]).ok).toBe(false);
  });
  it("rejects an empty approval (no approved facts → no Apply)", () => {
    expect(validateApproval(proposal, []).ok).toBe(false);
  });
  it("rejects duplicates and non-arrays", () => {
    expect(validateApproval(proposal, ["doc-07-lab-1", "doc-07-lab-1"]).ok).toBe(false);
    expect(validateApproval(proposal, "doc-07-lab-1").ok).toBe(false);
    expect(validateApproval(proposal, [{ id: "doc-07-lab-1", value: 99 }]).ok).toBe(false);
  });
});

describe("added document metadata comes from the document, not the model", () => {
  it("cuts the title from the page text when the model's type is found there", () => {
    const d = addedDocumentRecord(livePages, "Follow-up consultation note", "2026-09-25", "doc-07");
    expect([d.title, d.documentType, d.pageCount, d.file, d.issuer]).toEqual([
      "Follow-up Consultation Note",
      "consultation_note",
      2,
      "doc-07.pdf",
      "",
    ]);
  });
  it("ignores the model's type when it is not in the text: neutral title, type 'other'", () => {
    const d = addedDocumentRecord(livePages, "Discharge summary", "2026-09-25", "doc-07");
    expect([d.title, d.documentType]).toEqual(["Added document", "other"]);
  });
  it("assigns the next document id", () => {
    expect(nextDocumentId(seed)).toBe("doc-07");
  });
});
