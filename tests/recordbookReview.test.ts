import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { TrustedState, Proposal } from "@/lib/model/types";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import type { Extraction } from "@/lib/extraction/verify";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
import { Review } from "@/components/add-record/AddRecord";
const seed: TrustedState = JSON.parse(
  readFileSync("data/seed/state.json", "utf8"),
);
const extraction: Extraction = {
  document: {
    documentType: "Follow-up consultation note",
    documentDate: "2026-09-25",
    page: 1,
    excerpt: "Date of consultation 25 Sep 2026",
  },
  labMeasurements: [
    {
      analyteName: "Ferritin",
      value: 32,
      unit: "μg/L",
      referenceRangeText: "15–150 μg/L",
      measuredOn: "2026-09-25",
      page: 2,
      excerpt:
        "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L).",
    },
  ],
  medicationStatements: [
    {
      medicationName: "oral iron (ferrous sulfate)",
      status: "current",
      page: 1,
      excerpt:
        "The patient continues to take oral iron (ferrous sulfate) once daily.",
    },
  ],
};
async function proposal() {
  const result = await runExtractionPipeline(
    new Uint8Array(
      readFileSync("demo-files/follow-up-consultation-2026-09-25.pdf"),
    ),
    seed,
    {
      extract: async () => ({ status: "ok", extraction, model: "stub" }),
      newProposalId: () => "00000000-0000-4000-8000-000000000099",
      now: () => "2026-10-10T00:00:00.000Z",
    },
  );
  if (result.status !== "proposal") throw new Error(result.status);
  return result.proposal;
}
function render(p: Proposal, rejected: Set<string>) {
  return renderToStaticMarkup(
    createElement(Review, {
      phase: { kind: "review", proposal: p, state: seed, rejected },
      setPhase() {},
      onCancel() {},
      onApply() {},
    }),
  );
}
describe("recordbook review preserves the approval selection", () => {
  it("starts with included facts and shows exact excerpts before approval", async () => {
    const p = await proposal();
    const html = render(p, new Set<string>());
    expect(html.match(/checked=""/g)).toHaveLength(2);
    expect(html).toContain("Add 2 facts to my record");
    expect(html).toContain("This document has not been added yet.");
    for (const f of p.facts) expect(html).toContain(f.source.verifiedExcerpt);
  });
  it("excluding the medication leaves one lab fact and its matching consequence", async () => {
    const p = await proposal();
    const med = p.facts.find((f) => f.kind === "medication_status")!;
    const html = render(p, new Set([med.id]));
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain("Add 1 fact to my record");
    expect(html).toContain("Later ferritin result documented");
    expect(html).not.toContain("Oral iron marked Ongoing");
  });
  it("excluding the lab removes its calculated consequence from the preview", async () => {
    const p = await proposal();
    const lab = p.facts.find((f) => f.kind === "lab_measurement")!;
    const html = render(p, new Set([lab.id]));
    expect(html).toContain("Add 1 fact to my record");
    expect(html).not.toContain("Later ferritin result documented");
    expect(html).toContain("Oral iron marked Ongoing");
  });
  it.each(["uncertain", "gone-after-uncertain"] as const)(
    "never claims the record is unchanged after %s approval",
    async (problem) => {
      const p = await proposal();
      const html = renderToStaticMarkup(
        createElement(Review, {
          phase: {
            kind: "review",
            proposal: p,
            state: seed,
            rejected: new Set<string>(),
            applyProblem: problem,
            uncertainBefore: true,
          },
          setPhase() {},
          onCancel() {},
          onApply() {},
        }),
      );
      expect(html).not.toContain("This document has not been added yet.");
      expect(html).not.toContain("Nothing changes until you add them.");
      expect(html).toContain(
        "The outcome of an earlier Add request is unconfirmed.",
      );
    },
  );
  it("an empty selection disables adding and leaves trusted input untouched", async () => {
    const p = await proposal();
    const before = JSON.stringify(seed);
    const html = render(p, new Set(p.facts.map((f) => f.id)));
    expect(html).not.toContain('checked=""');
    expect(html).toContain(
      "No facts selected. Your record will stay as it is.",
    );
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Add 0 facts to my record/,
    );
    expect(JSON.stringify(seed)).toBe(before);
  });
});
