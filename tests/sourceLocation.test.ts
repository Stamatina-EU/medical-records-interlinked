/** UTF-16 source-location containment: a matched excerpt maps to that occurrence or fails closed. */
import { describe, expect, it } from "vitest";
import { findOriginalRanges, normalize, normalizeSource, normalizeWithMap } from "@/lib/text/normalize";
import { locateExcerpt, verifyExtraction, type Extraction } from "@/lib/extraction/verify";

const header = "Date of consultation 25 Sep 2026";
const result = "Ferritin 32 ng/mL (reference range 15-150 ng/mL).";
const unsupported = "Ferritin 10³ ng/mL (reference range 15-150 ng/mL).";
const supported = "Ferritin 103 ng/mL (reference range 15-150 ng/mL).";
const ctx = { documentId: "doc-07", episodes: [{ id: "ep-oral-iron", topic: "iron" as const, name: "Oral iron" }] };
const page = (...body: string[]) => ["Synthetic audit fixture - fictional patient", header, "RESULTS", ...body].join("\n");
const extraction = (excerpt: string, value: number): Extraction => ({
  document: { documentType: "Synthetic audit note", documentDate: "2026-09-25", page: 1, excerpt: header },
  labMeasurements: [{ analyteName: "Ferritin", value, unit: "ng/mL", referenceRangeText: "15-150 ng/mL", measuredOn: "2026-09-25", page: 1, excerpt }],
  medicationStatements: [],
});
const verify = (text: string, excerpt: string, value: number) => verifyExtraction([text], extraction(excerpt, value), ctx);

describe("UTF-16 position map", () => {
  it.each(["source", "search"] as const)("%s profile maps every normalized UTF-16 code unit", (profile) => {
    const original = "A 🧪 𝟛 𠮷 𐐀 İ ﬃ  B";
    const mapped = normalizeWithMap(original, profile);
    expect(mapped.start).toHaveLength(mapped.text.length);
    expect(mapped.end).toHaveLength(mapped.text.length);
    for (let i = 0; i < mapped.text.length; i++) {
      expect(mapped.start[i]).toBeGreaterThanOrEqual(0);
      expect(mapped.end[i]).toBeLessThanOrEqual(original.length);
      expect(mapped.end[i]).toBeGreaterThan(mapped.start[i]);
    }
    const emoji = mapped.text.indexOf("🧪");
    expect(mapped.start.slice(emoji, emoji + 2)).toEqual([original.indexOf("🧪"), original.indexOf("🧪")]);
    expect(mapped.end.slice(emoji, emoji + 2)).toEqual([original.indexOf("🧪") + 2, original.indexOf("🧪") + 2]);
  });

  it("keeps exact original offsets for a match containing supplementary characters", () => {
    const excerpt = "Quoted 🧪 𠮷 𝟛 text";
    const text = "Earlier 🧬 text.\n" + excerpt + "\nLater 🎵 text.";
    const loc = locateExcerpt([text], 1, excerpt);
    expect(loc).toMatchObject({ ok: true, from: text.indexOf(excerpt), to: text.indexOf(excerpt) + excerpt.length, verifiedExcerpt: excerpt });
  });

  it("rejects a match that cuts a surrogate pair or only part of a normalization expansion", () => {
    expect(findOriginalRanges("🧪", "\ud83e", "source")).toEqual([]);
    expect(findOriginalRanges("🧪", "\uddea", "source")).toEqual([]);
    expect(findOriginalRanges("İ", "i", "source")).toEqual([]);
    expect(findOriginalRanges("ﬃ", "f", "search")).toEqual([]);
    expect(findOriginalRanges("ﬃ", "ffi", "search")).toEqual([{ from: 0, to: 1 }]);
  });
});

describe("canonical source occurrence", () => {
  it.each(["🧪", "𝟛", "𠮷", "𝄞", "𐐀"])("%s in unrelated earlier lines cannot shift a later fact", (character) => {
    const text = page("Unrelated earlier text " + character.repeat(51) + ".", result);
    const loc = locateExcerpt([text], 1, result);
    expect(loc).toMatchObject({ ok: true, from: text.indexOf(result), to: text.indexOf(result) + result.length, verifiedExcerpt: result });
    const r = verify(text, result, 32);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.verified).toMatchObject([{ value: 32, source: { verifiedExcerpt: result } }]);
  });

  it("supplementary characters before the header and after the excerpt preserve both locations", () => {
    const text = ["Synthetic 🧪 fictional patient 𠮷", header, "RESULTS", result, "Later 🧬 𝟛 text."].join("\n");
    expect(locateExcerpt([text], 1, header)).toMatchObject({ ok: true, from: text.indexOf(header), verifiedExcerpt: header });
    expect(locateExcerpt([text], 1, result)).toMatchObject({ ok: true, from: text.indexOf(result), verifiedExcerpt: result });
    expect(verify(text, result, 32).status).toBe("ok");
  });

  it("a BMP-only page retains exact offsets and canonical wording after allowed normalization", () => {
    const canonical = "Ferritin  32 ng/mL (reference range 15–150 ng/mL).";
    const text = page("Earlier ordinary text.", canonical);
    const model = "ferritin 32 ng/ml (reference range 15-150 ng/ml).";
    const loc = locateExcerpt([text], 1, model);
    expect(loc).toMatchObject({ ok: true, from: text.indexOf(canonical), to: text.indexOf(canonical) + canonical.length, verifiedExcerpt: canonical });
    if (loc.ok) expect(normalizeSource(loc.verifiedExcerpt)).toBe(normalizeSource(model));
    expect(verify(text, model, 32).status).toBe("ok");
  });

  it("duplicate excerpts after supplementary characters remain ambiguous", () => {
    const text = page("Unrelated 🧪 𝟛 text.", result, "Between 𠮷 excerpts.", result);
    const offsets = [text.indexOf(result), text.lastIndexOf(result)];
    expect(findOriginalRanges(text, result, "source")).toEqual(offsets.map((from) => ({ from, to: from + result.length })));
    expect(locateExcerpt([text], 1, result)).toMatchObject({ ok: false, reason: expect.stringMatching(/occurs 2 times/) });
    expect(verify(text, result, 32)).toMatchObject({ status: "unusable", code: "none_verified" });
  });
});

describe("the confirmed source-substitution regression", () => {
  const text = page("Synthetic markers " + "𝟛".repeat(51) + ".", unsupported, supported, "End of synthetic report.");

  it("51 × 𝟛 cannot remap the 10³ excerpt onto the later 103 line", () => {
    expect(locateExcerpt([text], 1, unsupported)).toMatchObject({
      ok: true, from: text.indexOf(unsupported), to: text.indexOf(unsupported) + unsupported.length, verifiedExcerpt: unsupported,
      context: { line: unsupported },
    });
    expect(verify(text, unsupported, 103)).toMatchObject({ status: "unusable", code: "none_verified" });
  });

  it("the separate supported line verifies only when that exact occurrence is quoted", () => {
    const r = verify(text, supported, 103);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.verified).toMatchObject([{ value: 103, source: { verifiedExcerpt: supported } }]);
  });

  it.each([103, 1000, 10])("the original 10³ notation cannot verify as %s", (value) => {
    const original = page(unsupported);
    expect(verify(original, unsupported, value)).toMatchObject({ status: "unusable", code: "none_verified" });
    expect(locateExcerpt([original], 1, normalize(unsupported))).toMatchObject({ ok: false });
  });
});
