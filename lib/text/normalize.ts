/**
 * Text normalization for MATCHING ONLY. Spec: `spec.md > Fact Verifier` (Step A).
 *
 * `normalizeWithMap` also records, for every normalized character, where it came from in the
 * original string. Normalization changes lengths (NFKC, collapsed whitespace), so normalized
 * offsets cannot be reused on the original text — the map lets the verifier cut the canonical
 * `verifiedExcerpt` out of the ORIGINAL page text.
 */

const DASHES = /[‐‑‒–—―−﹘﹣－]/;
const SINGLE_QUOTES = /[‘’‚‛′]/;
const DOUBLE_QUOTES = /[“”„‟″]/;
const WHITESPACE = /\s/;

export type NormalizedText = {
  text: string;
  /** start[i] = index in the original string of the char that produced normalized char i */
  start: number[];
  /** end[i] = index just past that original char */
  end: number[];
};

export function normalizeWithMap(original: string): NormalizedText {
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
    else if (DASHES.test(ch)) out = "-";
    else if (SINGLE_QUOTES.test(ch)) out = "'";
    else if (DOUBLE_QUOTES.test(ch)) out = '"';
    else out = ch.normalize("NFKC").toLowerCase();

    for (const o of out) {
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
export function normalize(s: string): string {
  return normalizeWithMap(s).text.trim();
}

/**
 * Find `needle` (any wording) inside `haystack` after normalization and return the
 * matching span of the ORIGINAL haystack text, or null if not found.
 */
export function findOriginalSpan(haystack: string, needle: string): string | null {
  const r = findOriginalRange(haystack, needle);
  return r ? haystack.slice(r.from, r.to) : null;
}

/** Like `findOriginalSpan`, but returns the [from, to) offsets of the (trimmed) span in the ORIGINAL haystack. */
export function findOriginalRange(haystack: string, needle: string): { from: number; to: number } | null {
  const n = normalize(needle);
  if (!n) return null;
  const h = normalizeWithMap(haystack);
  const idx = h.text.indexOf(n);
  if (idx === -1) return null;
  let from = h.start[idx];
  let to = h.end[idx + n.length - 1];
  while (from < to && /\s/.test(haystack[from])) from++;
  while (to > from && /\s/.test(haystack[to - 1])) to--;
  return { from, to };
}
