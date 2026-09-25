/** Doctor Summary composer — `spec.md > Summary Composer`, `prd.md > Doctor Summary`. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Proposal, TrustedState } from "@/lib/model/types";
import { derive } from "@/lib/engine/derive";
import { apply } from "@/lib/engine/apply";
import { composeDoctorSummary, refKey } from "@/lib/summary/compose";

const seed: TrustedState = JSON.parse(readFileSync(path.resolve(__dirname, "../data/seed/state.json"), "utf8"));

const proposal: Proposal = {
  proposalId: "00000000-0000-4000-8000-000000000000",
  document: { id: "doc-07", title: "Follow-up Consultation Note", documentType: "consultation_note", issuer: "", date: "2026-09-25", file: "doc-07.pdf", pageCount: 2, origin: "added" },
  excludedCount: 0,
  createdAt: "2026-09-26T10:00:00.000Z",
  facts: [
    { id: "doc-07-lab-1", kind: "lab_measurement", topic: "iron", analyte: "ferritin", value: 32, unit: "μg/L", refLow: 15, refHigh: 150, refText: "15–150", measuredOn: "2026-09-25", source: { documentId: "doc-07", page: 2, verifiedExcerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }, review: "PROPOSED" },
    { id: "doc-07-med-1", kind: "medication_status", episodeId: "ep-oral-iron", status: "Completed", documentedOn: "2026-09-25", source: { documentId: "doc-07", page: 1, verifiedExcerpt: "The patient completed the prescribed course of oral iron (ferrous sulfate) in May 2026." }, review: "PROPOSED" },
  ],
};
const after = apply(seed, proposal, ["doc-07-lab-1", "doc-07-med-1"], "2026-09-26T10:05:00.000Z");
const compose = (s: TrustedState) => composeDoctorSummary(s, derive(s));
const allText = (s: TrustedState) => compose(s).sections.flatMap((x) => x.statements.map((st) => st.text)).join("\n");

const ABSENCE = /\b(no|none|not found|without|absent|missing)\b/i;
const DIAGNOSIS = /(an(a)?emia|deficien|diagnos|disease|disorder|\babnormal\b|\bnormal\b)/i;

describe.each([
  ["seed", seed],
  ["after update", after],
])("Doctor Summary invariants (%s)", (_label, state) => {
  const summary = compose(state);

  it("has no empty section", () => {
    expect(summary.sections.length).toBeGreaterThan(0);
    for (const s of summary.sections) expect(s.statements.length).toBeGreaterThan(0);
  });

  it("every statement carries evidence refs that resolve to numbered sources", () => {
    const factIds = new Set(state.facts.map((f) => f.id));
    const claimKeys = new Set(derive(state).map((c) => c.key));
    for (const st of summary.sections.flatMap((s) => s.statements)) {
      expect(st.refs.length).toBeGreaterThan(0);
      for (const r of st.refs) {
        expect(r.type === "fact" ? factIds.has(r.id) : claimKeys.has(r.key)).toBe(true);
        expect(summary.sourceNumbers[refKey(r)]?.length).toBeGreaterThan(0);
      }
    }
    expect(summary.sources.map((s) => s.n)).toEqual(summary.sources.map((_, i) => i + 1));
  });

  it("never states absence and never uses a diagnostic label", () => {
    const text = allText(state);
    expect(text).not.toMatch(ABSENCE);
    expect(text).not.toMatch(DIAGNOSIS);
  });
});

describe("Doctor Summary content before and after the update", () => {
  it("seed: 2 ferritin results, Prescribed, recommendation without a match, imaging comparison; nothing marked updated", () => {
    const s = compose(seed);
    const text = allText(seed);
    expect(s.sections.map((x) => x.id)).toEqual(["history", "investigations", "treatment", "follow-up", "imaging"]);
    expect(text).toContain("measured 2 times");
    expect(text).toContain("19.6 μg/L");
    expect(text).toMatch(/— Prescribed\./);
    expect(text).not.toContain("later approved ferritin result");
    expect(text).toContain("compared with the examination of 10 Sep 2025");
    expect(s.sections.flatMap((x) => x.statements).some((st) => st.updated)).toBe(false);
    expect(s.documentCount).toBe(6);
  });

  it("after: 3 results, Completed with the earlier Prescribed, match found, affected lines marked, new document cited", () => {
    const s = compose(after);
    const text = allText(after);
    expect(text).toContain("measured 3 times");
    expect(text).toContain("32 μg/L");
    expect(text).toMatch(/— Completed\..*Earlier: prescribed/);
    expect(text).toContain("A later approved ferritin result has been found (25 Sep 2026).");
    const updated = s.sections.flatMap((x) => x.statements).filter((st) => st.updated).map((st) => st.text);
    expect(updated.length).toBeGreaterThanOrEqual(3);
    expect(updated.some((t) => t.startsWith("Ferritin — 32"))).toBe(true);
    expect(s.sources.some((src) => src.document.id === "doc-07")).toBe(true);
    expect(s.asOf).toBe("2026-09-26T10:05:00.000Z");
    expect(s.documentCount).toBe(7);
  });

  it("no 'Current medication' section unless a status is explicitly Current", () => {
    expect(compose(seed).sections.some((x) => x.id === "current-medication")).toBe(false);
    expect(compose(after).sections.some((x) => x.id === "current-medication")).toBe(false);
  });
});
