/** Doctor Summary composer — `spec.md > Summary Composer`, `prd.md > Doctor Summary`. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LabMeasurement, MedicationStatusEvent, Proposal, SourceFact, TrustedState } from "@/lib/model/types";
import { derive } from "@/lib/engine/derive";
import { apply } from "@/lib/engine/apply";
import { composeDoctorSummary, refKey, type SummaryRef } from "@/lib/summary/compose";

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
const compose = (s: TrustedState) => composeDoctorSummary(s, derive(s));
const allText = (s: TrustedState) => compose(s).sections.flatMap((x) => x.statements.map((st) => st.text)).join("\n");

/** Every approved fact a statement rests on: its fact refs plus the inputs of its derived claims. */
function inputsOf(state: TrustedState, st: { refs: SummaryRef[] }): string[] {
  const claims = new Map([...derive(state), ...compose(state).claims].map((c) => [c.key, c]));
  return st.refs.flatMap((r) => (r.type === "fact" ? [r.id] : (claims.get(r.key)?.inputFactIds ?? [])));
}

const ABSENCE = /\b(no|none|not found|without|absent|missing)\b/i;
// what makes a statement Derived: counting, ordering / "latest", matching
const COUNT = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.]*\b(measurements?|results?|times|courses?)\b/i;
const ORDERING = /\b(latest|most recent(ly)?|earliest|first|previous)\b/i;
const MATCHING = /\bmatch(es|ing)?\b/i;
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
    const claimKeys = new Set([...derive(state), ...summary.claims].map((c) => c.key));
    for (const st of summary.sections.flatMap((s) => s.statements)) {
      expect(st.refs.length).toBeGreaterThan(0);
      for (const r of st.refs) {
        expect(r.type === "fact" ? factIds.has(r.id) : claimKeys.has(r.key)).toBe(true);
        expect(summary.sourceNumbers[refKey(r)]?.length).toBeGreaterThan(0);
      }
    }
    expect(summary.sources.map((s) => s.n)).toEqual(summary.sources.map((_, i) => i + 1));
  });

  it("a counted statement cites every measurement it counts, and each one's document is in Sources (regression)", () => {
    const labs = new Map(state.facts.filter((f) => f.kind === "lab_measurement").map((f) => [f.id, f]));
    const counted = summary.sections.flatMap((s) => s.statements).filter((st) => /measured (\d+) times/.test(st.text));
    expect(counted.length).toBeGreaterThan(0);
    const sourceDocs = new Set(summary.sources.map((s) => s.document.id));
    for (const st of counted) {
      const n = Number(st.text.match(/measured (\d+) times/)![1]);
      expect(st.derived).toBe(true);
      const cited = inputsOf(state, st).filter((id) => labs.has(id));
      const counts = [...labs.values()].filter((f) => f.kind === "lab_measurement" && f.analyte === "ferritin").map((f) => f.id);
      expect(counts.length).toBe(n);
      expect(new Set(cited)).toEqual(new Set(counts));
      for (const id of counts) expect(sourceDocs.has(labs.get(id)!.source.documentId)).toBe(true);
    }
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
    expect(s.sections.map((x) => x.id)).toEqual(["picture", "history", "investigations", "treatment", "follow-up", "imaging"]);
    expect(text).toContain("measured 2 times");
    expect(text).toContain("19.6 μg/L");
    expect(text).toMatch(/— Prescribed\./);
    expect(text).not.toContain("later approved ferritin result");
    expect(text).toContain("compared with the examination of 10 Sep 2025");
    expect(s.sections.flatMap((x) => x.statements).some((st) => st.updated)).toBe(false);
    expect(s.documentCount).toBe(6);
    expect(s.latestSourceDate).toBe("2026-03-12");
    expect(text).toContain("Oral iron (ferrous sulfate) — Prescribed. Status documented in prescription dated 3 Feb 2026.");
  });

  it("after: 3 results, Ongoing with the earlier Prescribed, match found, affected lines marked, new document cited", () => {
    const s = compose(after);
    const text = allText(after);
    expect(text).toContain("measured 3 times");
    expect(text).toContain("32 μg/L");
    expect(text).toContain("Oral iron (ferrous sulfate) — Ongoing. Status documented in follow-up consultation note dated 25 Sep 2026. Also documented: Prescribed, 3 Feb 2026.");
    // no ordering word in the detailed medication line; each status fact keeps its own source
    const medSt = s.sections.find((x) => x.id === "current-medication")!.statements[0];
    expect(medSt.text).not.toMatch(/(earlier|previously|before|after|then)/i);
    expect(medSt.refs).toEqual([
      { type: "fact", id: "doc-07-med-1" },
      { type: "fact", id: "med-oral-iron-2026-02-03-prescribed" },
    ]);
    expect(text).toContain("A later approved ferritin result has been found (25 Sep 2026).");
    const updated = s.sections.flatMap((x) => x.statements).filter((st) => st.updated).map((st) => st.text);
    expect(updated.length).toBeGreaterThanOrEqual(3);
    expect(updated.some((t) => t.startsWith("Ferritin — 32"))).toBe(true);
    expect(s.sources.some((src) => src.document.id === "doc-07")).toBe(true);
    expect(s.latestSourceDate).toBe("2026-09-25");
    expect(s.documentCount).toBe(7);
  });

  it("'Current medication' appears only when the latest status is explicitly Current", () => {
    expect(compose(seed).sections.some((x) => x.id === "current-medication")).toBe(false);
    expect(compose(seed).sections.some((x) => x.id === "treatment")).toBe(true);
    expect(compose(after).sections.map((x) => x.id)).toEqual(["picture", "history", "investigations", "current-medication", "follow-up", "imaging"]);
  });
});

// ── Current documented picture ────────────────────────────────────────────────
const picture = (s: TrustedState) => composeDoctorSummary(s, derive(s)).sections.find((x) => x.id === "picture")!.statements;
const pictureText = (s: TrustedState) => picture(s).map((st) => st.text).join(" ");
const factIds = (refs: SummaryRef[]) => refs.flatMap((r) => (r.type === "fact" ? [r.id] : []));

/** Add synthetic facts (and their documents) to a copy of a state. */
function withFacts(base: TrustedState, facts: SourceFact[], episodes: TrustedState["episodes"] = []): TrustedState {
  const docs = [...new Set(facts.map((f) => f.source.documentId))]
    .filter((id) => !base.documents.some((d) => d.id === id))
    .map((id) => ({ id, title: "Fixture Document", documentType: "consultation_note" as const, issuer: "Fixture Clinic", date: "2026-09-20", file: `${id}.pdf`, pageCount: 1, origin: "seed" as const }));
  return { ...base, documents: [...base.documents, ...docs], episodes: [...base.episodes, ...episodes], facts: [...base.facts, ...facts] };
}
const src = (documentId: string) => ({ documentId, page: 1, verifiedExcerpt: "fixture" });
const lab = (id: string, value: number, measuredOn: string, refLow = 15, refHigh = 150): LabMeasurement => ({
  id, kind: "lab_measurement", topic: "iron", analyte: "ferritin", value, unit: "μg/L", refLow, refHigh, refText: `${refLow}–${refHigh}`, measuredOn, source: src("doc-fx"), review: "APPROVED",
});
const med = (id: string, episodeId: string, status: MedicationStatusEvent["status"], documentedOn: string): MedicationStatusEvent => ({
  id, kind: "medication_status", episodeId, status, documentedOn, source: src("doc-fx"), review: "APPROVED",
});

describe("Current documented picture", () => {
  const texts = (s: TrustedState) => picture(s).map((st) => [st.derived ? "DERIVED" : "direct", st.text]);

  it("seed and post-update versions, each sentence classified Direct or Derived", () => {
    expect(texts(seed)).toEqual([
      ["DERIVED", "Two ferritin measurements are documented, most recently 19.6 μg/L on 27 Jan 2026."],
      ["direct", "Oral iron (ferrous sulfate) is documented as prescribed."],
      ["DERIVED", "The latest documented thyroid ultrasound is dated 12 Mar 2026."],
      ["direct", "The 12 Mar 2026 report explicitly compares it with the examination of 10 Sep 2025."],
    ]);
    expect(texts(after)).toEqual([
      ["DERIVED", "Three ferritin measurements are documented, most recently 32 μg/L on 25 Sep 2026."],
      ["direct", "Oral iron (ferrous sulfate) is documented as ongoing."],
      ["DERIVED", "A later ferritin result matching the recommended test is documented."],
      ["DERIVED", "The latest documented thyroid ultrasound is dated 12 Mar 2026."],
      ["direct", "The 12 Mar 2026 report explicitly compares it with the examination of 10 Sep 2025."],
    ]);
  });

  it("counts are Derived, and the claim lists every counted fact", () => {
    const low = withFacts(after, [lab("fx-lab-1", 9, "2026-09-20")]);
    for (const state of [seed, after, low]) {
      const ferritin = state.facts.filter((f) => f.kind === "lab_measurement").map((f) => f.id);
      const counted = compose(state).sections.flatMap((x) => x.statements).filter((st) => COUNT.test(st.text));
      expect(counted.length).toBeGreaterThan(0);
      for (const st of counted) {
        expect(st.derived).toBe(true);
        expect(st.refs.every((r) => r.type === "claim")).toBe(true);
        expect(new Set(inputsOf(state, st))).toEqual(new Set(ferritin));
      }
    }
    const belowSt = picture(low).find((st) => st.text.includes("below the laboratory range"))!;
    expect(belowSt.text).toBe("Two of four ferritin results are below the laboratory range supplied with that result (14 Mar 2025, 20 Sep 2026).");
    expect(pictureText(after)).not.toContain("below"); // one result below range is not "repeated"
  });

  it("'latest' / ordering claims are Derived and expose every item that was ordered", () => {
    for (const state of [seed, after]) {
      const ordered = picture(state).filter((st) => ORDERING.test(st.text));
      expect(ordered.length).toBeGreaterThan(0);
      for (const st of ordered) expect(st.derived).toBe(true);
      const latestExam = picture(state).find((st) => st.text.startsWith("The latest documented thyroid ultrasound"))!;
      const exams = state.facts.filter((f) => f.kind === "imaging_exam").map((f) => f.id);
      expect(new Set(inputsOf(state, latestExam))).toEqual(new Set(exams));
    }
  });

  it("matching claims are Derived, use the recommendation AND the later result, and never judge timing", () => {
    const st = picture(after).find((x) => MATCHING.test(x.text))!;
    expect(st.derived).toBe(true);
    expect(new Set(inputsOf(after, st))).toEqual(new Set(["fu-ferritin-2026-02-03", "doc-07-lab-1"]));
    // "later" is chronology and allowed; "late" is a timing judgement and is not
    expect(pictureText(after)).not.toMatch(/\b(on time|due|overdue|satisf\w*|late|timely|delayed)\b/i);
  });

  it("an explicitly sourced medication status is Direct and cites only the status fact that states it", () => {
    const med = (s: TrustedState) => picture(s).find((x) => x.text.startsWith("Oral iron"))!;
    expect(med(after).derived).toBe(false);
    expect(med(after).refs).toEqual([{ type: "fact", id: "doc-07-med-1" }]);
    expect(med(seed).refs).toEqual([{ type: "fact", id: "med-oral-iron-2026-02-03-prescribed" }]);
  });

  it("a statement is never Direct merely because its inputs are source-backed", () => {
    const low = withFacts(after, [lab("fx-lab-1", 9, "2026-09-20")]);
    for (const state of [seed, after, low]) {
      for (const st of picture(state).filter((x) => !x.derived)) {
        // Direct = exactly one source fact states it, with no counting, ordering or matching
        expect(st.refs).toHaveLength(1);
        expect(st.refs[0].type).toBe("fact");
        expect(st.text).not.toMatch(COUNT);
        expect(st.text).not.toMatch(ORDERING);
        expect(st.text).not.toMatch(MATCHING);
      }
      for (const st of picture(state).filter((x) => x.derived)) {
        // Derived = a derived claim whose inputs are all approved facts
        expect(st.refs.every((r) => r.type === "claim")).toBe(true);
        const ids = inputsOf(state, st);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) expect(state.facts.some((f) => f.id === id)).toBe(true);
      }
    }
  });

  it("medication wording changes only when the latest explicitly approved status changes", () => {
    const line = (s: TrustedState) => picture(s).find((st) => st.text.startsWith("Oral iron"))!.text;
    expect(line(seed)).toBe("Oral iron (ferrous sulfate) is documented as prescribed.");
    // adding only the ferritin result (no status evidence) leaves the wording unchanged
    const labOnly = apply(seed, proposal, ["doc-07-lab-1"], "2026-09-26T10:05:00.000Z");
    expect(line(labOnly)).toBe("Oral iron (ferrous sulfate) is documented as prescribed.");
    // explicit Current evidence (the live note) -> "ongoing"
    expect(line(after)).toBe("Oral iron (ferrous sulfate) is documented as ongoing.");
    // explicit Completed / Stopped evidence -> "completed" / "stopped"
    expect(line(withFacts(seed, [med("fx-done", "ep-oral-iron", "Completed", "2026-05-01")]))).toBe("Oral iron (ferrous sulfate) is documented as completed.");
    expect(line(withFacts(seed, [med("fx-stop", "ep-oral-iron", "Stopped", "2026-05-01")]))).toBe("Oral iron (ferrous sulfate) is documented as stopped.");
  });

  it("never invents an absence or a diagnosis, and never labels a value 'low'", () => {
    const low = withFacts(after, [lab("fx-lab-1", 9, "2026-09-20")]);
    for (const state of [seed, after, low]) {
      const text = pictureText(state);
      expect(text).not.toMatch(ABSENCE);
      expect(text).not.toMatch(DIAGNOSIS);
      expect(text).not.toMatch(/\b(low|high|concerning|recurrent|poorly|risk|needs? treatment)\b/i);
    }
  });
});
