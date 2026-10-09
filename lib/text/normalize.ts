/**
 * Text normalization for MATCHING ONLY. Spec: `spec.md > Fact Verifier` (Step A).
 *
 * Two profiles:
 *  - `"source"` — SOURCE-FAITHFUL, for every authoritative verification step. It applies NO Unicode compatibility
 *    folding: a superscript, subscript, circled or full-width digit, a vulgar fraction, a compatibility sign stays
 *    exactly what it is, so it can never turn into a supported ASCII number ("10³" never becomes "103"). Only an
 *    explicit allowlist of meaning-preserving unifications: whitespace, curly quotes, the hyphen and en dash, the
 *    micro sign (µ → μ) and letter case.
 *  - `"search"` (default) — permissive, for non-authoritative matching only (a document title, the names the model
 *    wrote): the same unifications plus NFKC compatibility folding and more dash variants.
 *
 * `normalizeWithMap` also records, for every normalized UTF-16 code unit, where it came from in the
 * original string. Normalization changes lengths (collapsed whitespace, NFKC), so normalized
 * offsets cannot be reused on the original text — the map lets the verifier cut the canonical
 * `verifiedExcerpt` out of the ORIGINAL page text.
 */

export type NormalizationProfile = "source" | "search";

const SEARCH_DASHES = /[‐‑‒–—―−﹘﹣－]/;
/** Only the hyphen-like dashes and the en dash: a minus sign or a full-width hyphen is not unified. */
const SOURCE_DASHES = /[‐‑–]/;
const SINGLE_QUOTES = /[‘’‚‛′]/;
const DOUBLE_QUOTES = /[“”„‟″]/;
const WHITESPACE = /\s/;
const MICRO_SIGN = "µ";
const GREEK_MU = "μ";

export type NormalizedText = {
  text: string;
  /** start[i] = UTF-16 offset in the original string of the code point that produced normalized code unit i */
  start: number[];
  /** end[i] = UTF-16 offset just past that original code point */
  end: number[];
};

export function normalizeWithMap(original: string, profile: NormalizationProfile = "search"): NormalizedText {
  let text = "";
  const start: number[] = [];
  const end: number[] = [];

  let i = 0;
  while (i < original.length) {
    const cp = original.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const next = i + ch.length;

    let out: string;
    if (WHITESPACE.test(ch)) out = " ";
    else if ((profile === "source" ? SOURCE_DASHES : SEARCH_DASHES).test(ch)) out = "-";
    else if (SINGLE_QUOTES.test(ch)) out = "'";
    else if (DOUBLE_QUOTES.test(ch)) out = '"';
    else if (profile === "source") out = (ch === MICRO_SIGN ? GREEK_MU : ch).toLowerCase();
    else out = ch.normalize("NFKC").toLowerCase();

    // String.indexOf and String.slice use UTF-16 offsets: both halves of a surrogate pair need map entries.
    for (let j = 0; j < out.length; j++) {
      const o = out[j];
      // collapse runs of whitespace into a single space
      if (o === " " && (text.length === 0 || text.endsWith(" "))) continue;
      text += o;
      start.push(i);
      end.push(next);
    }
    i = next;
  }
  return { text, start, end };
}

/** Normalized form used for comparisons (trimmed). */
export function normalize(s: string, profile: NormalizationProfile = "search"): string {
  return normalizeWithMap(s, profile).text.trim();
}

/** The source-faithful form every authoritative verification step compares (see the `"source"` profile). */
export const normalizeSource = (s: string): string => normalize(s, "source");

/**
 * Find `needle` (any wording) inside `haystack` after normalization and return the
 * matching span of the ORIGINAL haystack text, or null if not found.
 */
export function findOriginalSpan(haystack: string, needle: string, profile: NormalizationProfile = "search"): string | null {
  const r = findOriginalRange(haystack, needle, profile);
  return r ? haystack.slice(r.from, r.to) : null;
}

/** Like `findOriginalSpan`, but returns the [from, to) offsets of the (trimmed) span in the ORIGINAL haystack. */
export function findOriginalRange(haystack: string, needle: string, profile: NormalizationProfile = "search"): { from: number; to: number } | null {
  return findOriginalRanges(haystack, needle, profile)[0] ?? null;
}

/** Every place `needle` occurs in `haystack` after normalization, as [from, to) offsets of the ORIGINAL text. */
export function findOriginalRanges(haystack: string, needle: string, profile: NormalizationProfile = "search"): { from: number; to: number }[] {
  const n = normalize(needle, profile);
  if (!n) return [];
  const h = normalizeWithMap(haystack, profile);
  const ranges: { from: number; to: number }[] = [];
  for (let idx = h.text.indexOf(n); idx !== -1; idx = h.text.indexOf(n, idx + 1)) {
    let from = h.start[idx];
    let to = h.end[idx + n.length - 1];
    while (from < to && /\s/.test(haystack[from])) from++;
    while (to > from && /\s/.test(haystack[to - 1])) to--;
    // A match must cover complete source segments, never part of a surrogate pair or a case/NFKC expansion.
    if (normalize(haystack.slice(from, to), profile) !== n) continue;
    ranges.push({ from, to });
  }
  return ranges;
}
