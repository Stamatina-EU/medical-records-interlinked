/**
 * Fact Verifier — THE TRUST GATE. Pure, deterministic code. Spec: `spec.md > Fact Verifier`.
 *
 * The model's excerpt is only a search key. Step A locates it on the stated page and cuts the
 * canonical `verifiedExcerpt` out of the ORIGINAL page text. Step B runs every semantic check
 * against that verifiedExcerpt — never against model text — verifying both the claimed
 * value/status AND the subject the claim is about.
 *
 * The same checkers verify hand-authored seed facts (`verifySeedState`), so live and seed
 * data meet one definition of "what counts as evidence".
 */
import type {
  DocumentRecord,
  FollowUp,
  ImagingExam,
  MedicationEpisode,
  MedicationStatus,
  ProposedFact,
  TrustedState,
} from "@/lib/model/types";
import { findOriginalRanges, findOriginalSpan, normalize } from "@/lib/text/normalize";
import { formatDate, isIsoDate } from "@/lib/text/dates";
import {
  ANALYTE_ALIASES,
  COMPARISON_CUES,
  DOCUMENT_DATE_LABELS,
  EXAM_ALIASES,
  FOLLOW_UP_CUES,
  HEADING_REJECT_WORDS,
  HISTORICAL_FRAME,
  HISTORICAL_WORDS,
  MEDICATION_ALIASES,
  NEGATION_WORDS,
  NON_FACTUAL_WORDS,
  QUALIFIER_SYMBOLS,
  QUALIFIER_WORDS,
  STATUS_CUES,
  THIRD_PARTY_WORDS,
  UNITS,
  containsPhrase,
  escapeRegExp,
} from "@/lib/extraction/lexicon";

export type Check<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

// ─── Model output shape (mirrors lib/extraction/schema.ts) ────────────────────────────────
export type ExtractedDocument = { documentType: string; documentDate: string; page: number; excerpt: string };
export type ExtractedLab = {
  analyteName: string;
  value: number;
  unit: string;
  referenceRangeText: string | null;
  measuredOn: string;
  page: number;
  excerpt: string;
};
export type ExtractedMedication = { medicationName: string; status: string; page: number; excerpt: string };
export type Extraction = {
  document: ExtractedDocument;
  labMeasurements: ExtractedLab[];
  medicationStatements: ExtractedMedication[];
};

// ─── Step A: locate the one occurrence + its source assertion unit ────────────────────────
/**
 * The AUTHORITATIVE source assertion unit around a located excerpt. The model only supplies a search key: code
 * finds the single place it occurs and decides the unit around it, so the model's excerpt boundaries never set
 * the semantic boundary, and a neighbouring sentence is never evidence.
 *  - `sentence`: the one source sentence holding the excerpt (it may wrap over lines; a heading or a blank line
 *    ends it, so "It is not true that\nthe patient …" is one sentence). `null` when the excerpt runs across a
 *    sentence end, a heading or a blank line — then no single unit holds it.
 *  - `row`: the part of that sentence on the excerpt's own source line — the result line. `null` when the
 *    excerpt runs across lines.
 *  - `headings`: the heading lines above the excerpt in the document. They can only ever REJECT a fact
 *    ("IF NEEDED", "PREVIOUS RESULTS", "FAMILY HISTORY"); they are never evidence for one.
 */
export type SourceContext = { sentence: string | null; row: string | null; headings: string[] };

/** Words whose final "." does not end a sentence. */
const ABBREVIATIONS = new Set(["dr", "mr", "mrs", "ms", "prof", "approx", "e.g", "i.e", "etc", "vs", "no", "ref", "st"]);

function endsSentence(text: string, i: number): boolean {
  if (!/[.!?;]/.test(text[i])) return false;
  if (i + 1 < text.length && !/\s/.test(text[i + 1])) return false; // "19.6", "e.g."
  if (text[i] === ".") {
    // the whole word before the "." ("approx", "e.g", an initial "J") — but "μg/L." or "150)." ends a sentence
    const word = (/(\S+)$/.exec(text.slice(0, i))?.[1] ?? "").replace(/^[(\["'“‘]+/, "").toLowerCase();
    if (ABBREVIATIONS.has(word) || /^[a-z]$/.test(word)) return false;
  }
  return true;
}

/** A heading line ("MEDICATION HISTORY", "IF NEEDED"): no lowercase letters and no trailing ",", ":" or ";". */
const isHeading = (line: string) => line.trim() !== "" && !/[a-z]/.test(line) && !/[,:;]\s*$/.test(line);
/** A heading or a blank line: no sentence runs across one. */
const isBoundaryLine = (line: string) => line.trim() === "" || isHeading(line);

/** [from, to) of the source line holding offset `i` (a "\n" belongs to the line it ends). */
function lineAt(text: string, i: number): { from: number; to: number } {
  const nl = text.indexOf("\n", i);
  return { from: text.lastIndexOf("\n", i - 1) + 1, to: nl === -1 ? text.length : nl };
}

/** The source assertion unit around [from, to) on `pages[page - 1]` (see `SourceContext`). */
export function sourceContext(pages: string[], page: number, from: number, to: number): SourceContext {
  const text = pages[page - 1];
  const first = lineAt(text, from);
  const last = lineAt(text, Math.max(from, to - 1));
  const headings = [...pages.slice(0, page - 1), text.slice(0, first.from)]
    .flatMap((p) => p.split("\n"))
    .filter(isHeading)
    .map((h) => h.trim());
  if (text.slice(first.from, last.to).split("\n").some(isBoundaryLine)) return { sentence: null, row: null, headings };

  let start = 0;
  for (let i = from - 1; i >= 0; i--) {
    if (endsSentence(text, i)) { start = i + 1; break; }
    if (text[i] === "\n" && isBoundaryLine(text.slice(lineAt(text, i).from, i))) { start = i + 1; break; }
  }
  let end = text.length;
  for (let j = from; j < text.length; j++) {
    if (endsSentence(text, j)) { end = j + 1; break; }
    if (text[j] === "\n") {
      const next = lineAt(text, j + 1);
      if (isBoundaryLine(text.slice(next.from, next.to))) { end = j; break; }
    }
  }
  if (to > end) return { sentence: null, row: null, headings }; // the excerpt runs into the next sentence
  return {
    sentence: text.slice(start, end).trim(),
    row: first.from === last.from ? text.slice(Math.max(start, first.from), Math.min(end, first.to)).trim() : null,
    headings,
  };
}

/** For a direct checker call without page text: the excerpt is its own (one-page, heading-free) source. */
const ownContext = (excerpt: string): SourceContext => sourceContext([excerpt], 1, 0, excerpt.length);

/**
 * Find the ONE place the excerpt occurs on the stated page. An excerpt that occurs more than once does not say
 * which statement it is ("currently taking oral iron" in "The patient is not currently taking oral iron. Her
 * mother is currently taking oral iron."), so it fails closed.
 */
export function locateExcerpt(
  pages: string[],
  page: number,
  excerpt: string,
): Check<{ verifiedExcerpt: string; from: number; to: number; context: SourceContext }> {
  if (!Number.isInteger(page) || page < 1 || page > pages.length) {
    return { ok: false, reason: `page ${page} does not exist` };
  }
  const text = pages[page - 1];
  const ranges = findOriginalRanges(text, excerpt);
  if (ranges.length === 0) return { ok: false, reason: `excerpt not found on page ${page}` };
  if (ranges.length > 1) {
    return { ok: false, reason: `excerpt occurs ${ranges.length} times on page ${page}, so which statement it is cannot be told` };
  }
  const { from, to } = ranges[0];
  return { ok: true, verifiedExcerpt: text.slice(from, to), from, to, context: sourceContext(pages, page, from, to) };
}

// ─── helpers ──────────────────────────────────────────────────────────────────────────────
function firstAlias(n: string, aliases: string[]): { alias: string; index: number } | null {
  let best: { alias: string; index: number } | null = null;
  for (const alias of aliases) {
    const m = new RegExp(`(^|[^a-z0-9])(${escapeRegExp(alias)})($|[^a-z0-9])`).exec(n);
    if (!m) continue;
    const index = m.index + m[1].length;
    if (!best || index < best.index || (index === best.index && alias.length > best.alias.length)) {
      best = { alias, index };
    }
  }
  return best;
}

function mentionsDate(n: string, iso: string): boolean {
  return n.includes(normalize(formatDate(iso))) || n.includes(iso);
}

// ─── dates ────────────────────────────────────────────────────────────────────────────────
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)";
/** A full written date in normalized text: "25 sep 2026", "25 september 2026", "2026-09-25". */
const FULL_DATE = `(?:(\\d{1,2}) (${MONTH}) (\\d{4})|(\\d{4})-(\\d{2})-(\\d{2}))`;
/** Anything else that dates a statement only partly or loosely: a month name, a year, a numeric date. */
const PARTIAL_DATE = new RegExp(`\\b${MONTH}\\b|\\b(?:19|20)\\d{2}\\b|\\b\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4}\\b`);

/** ISO form of a FULL_DATE match (groups 1–6), or null for an impossible date ("31 feb 2026"). */
function isoFromMatch(g: (string | undefined)[]): string | null {
  const iso = g[0]
    ? `${g[2]}-${String(MONTHS.indexOf(g[1]!.slice(0, 3)) + 1).padStart(2, "0")}-${g[0].padStart(2, "0")}`
    : `${g[3]}-${g[4]}-${g[5]}`;
  return isIsoDate(iso) ? iso : null;
}

/**
 * The dates an assertion unit states: every full date (as ISO), whether anything dates it only partly
 * ("May 2026", "2025", "in January") or impossibly, and the text with the full dates taken out (so the month in
 * "3 May 2026" is never read as the word "may").
 */
function readDates(n: string): { dates: string[]; partial: boolean; rest: string } {
  const dates: string[] = [];
  let impossible = false;
  const rest = n
    .replace(new RegExp(`\\b${FULL_DATE}\\b`, "g"), (...m: string[]) => {
      const iso = isoFromMatch(m.slice(1, 7));
      if (iso) dates.push(iso);
      else impossible = true;
      return " ";
    })
    .replace(/ {2,}/g, " ");
  return { dates, partial: impossible || PARTIAL_DATE.test(rest), rest };
}

/**
 * THE document date, derived by code from the document header: the lines of page 1 above the first section
 * heading. A header line counts only when it BEGINS with an allowed label (`DOCUMENT_DATE_LABELS`) followed
 * directly by a full date. Exactly one such date must be found; none, or two different ones, fails closed. A
 * later section ("HISTORICAL CONSULTATION / Consultation date: 27 Jan 2026") is below a heading, so it can never
 * be — or override — the document date. Returns the date and the header line(s) stating it.
 */
export function headerDocumentDate(firstPage: string): Check<{ date: string; lines: { from: number; to: number }[] }> {
  const labels = [...DOCUMENT_DATE_LABELS].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const re = new RegExp(`^(?:${labels}) ?:? ?${FULL_DATE}(?![0-9a-z])`);
  const found: { date: string; from: number; to: number }[] = [];
  let offset = 0;
  for (const line of firstPage.split("\n")) {
    const from = offset;
    offset += line.length + 1;
    if (isHeading(line)) break; // the header ends at the first section heading
    const m = re.exec(normalize(line));
    if (!m) continue;
    const date = isoFromMatch(m.slice(1, 7));
    if (!date) return { ok: false, reason: "the document header states an impossible date" };
    found.push({ date, from, to: from + line.length });
  }
  const distinct = [...new Set(found.map((f) => f.date))];
  if (distinct.length === 0) return { ok: false, reason: "the document header does not state the document's date" };
  if (distinct.length > 1) return { ok: false, reason: "the document header states more than one document date" };
  return { ok: true, date: distinct[0], lines: found.map(({ from, to }) => ({ from, to })) };
}

// ─── rejection rules shared by every assertion unit ───────────────────────────────────────
/**
 * Why an assertion unit (with its full dates already taken out) does not state a fact about the patient at the
 * document's own time — or null. Fails closed on: a question, a negation, anything hypothetical, conditional,
 * planned or recommended, someone other than the patient, or an earlier time.
 */
function unitRejection(rest: string): string | null {
  if (rest.includes("?")) return "the source asks a question; it does not state a fact";
  if (NEGATION_WORDS.some((w) => containsPhrase(rest, w)) || /n't\b/.test(rest)) return "the source negates it";
  if (NON_FACTUAL_WORDS.some((w) => containsPhrase(rest, w))) return "the source makes it hypothetical, conditional, planned or recommended";
  if (THIRD_PARTY_WORDS.some((w) => containsPhrase(rest, w))) return "the source is about someone other than the patient";
  if (HISTORICAL_WORDS.some((w) => containsPhrase(rest, w)) || HISTORICAL_FRAME.test(rest)) {
    return "the source describes an earlier time, not the document's own date";
  }
  return null;
}

/** Headings above a statement can only reject it: conditional, historical, uncertain, negated or someone else's. */
function headingRejection(headings: string[]): string | null {
  const hit = headings.find((h) => HEADING_REJECT_WORDS.some((w) => containsPhrase(normalize(h), w)));
  return hit ? `it sits under the heading "${hit}", so it is not stated as a current fact about the patient` : null;
}

/** The only words allowed between the analyte name and its value: they cannot introduce another test. */
const RESULT_LINKERS = new Set(["on", "of", "at", "in", "was", "is", "were", "are", "level", "levels", "result", "results", "value", "measured", "serum", "plasma", "test", "dated", "reported"]);
/** The only words allowed before the analyte name on its result line. */
const RESULT_LEADS = new Set(["the", "plasma"]);

function analyteFor(name: string): "ferritin" | null {
  const n = normalize(name);
  for (const [key, aliases] of Object.entries(ANALYTE_ALIASES)) {
    if (aliases.some((a) => containsPhrase(n, a))) return key as "ferritin";
  }
  return null;
}

function episodeFor(name: string, episodes: MedicationEpisode[]): string | null {
  const n = normalize(name);
  for (const ep of episodes) {
    const aliases = MEDICATION_ALIASES[ep.id] ?? [];
    if (aliases.some((a) => containsPhrase(n, a))) return ep.id;
  }
  return null;
}

function toStatus(s: string): MedicationStatus | null {
  const map: Record<string, MedicationStatus> = {
    prescribed: "Prescribed",
    current: "Current",
    completed: "Completed",
    stopped: "Stopped",
  };
  return map[normalize(s)] ?? null;
}

// ─── Step B: semantic checkers (each on its one source assertion unit) ────────────────────

/**
 * Lab: verified ONLY on the source result line that holds the excerpt (`context.row`) — never on the excerpt's
 * boundaries, never borrowing from another line or sentence. On that one line:
 *  - identity: the line opens with the analyte's name and names it once ("Approximately ferritin …",
 *    "Previous ferritin …", "32 μg/L ferritin" fail);
 *  - exact scalar only: no comparator or qualifier anywhere on the line (">150", "150 μg/L (or more)", "~32",
 *    "approximately"), even where the excerpt leaves it out;
 *  - the value is the first number + unit after the name, with only linking words and dates in between;
 *  - a claimed range is the one written directly after that value;
 *  - the date is the line's own full date, or — when the line has none — the document date;
 *  - not negated, hypothetical, about someone else or historical, and not under a heading that makes it so.
 * The excerpt itself must show the name, the value and unit (and a claimed range): that is what the patient sees.
 * Without a source context (direct calls), the excerpt is its own source.
 */
export function verifyLabFact(
  claim: Pick<ExtractedLab, "analyteName" | "value" | "unit" | "referenceRangeText" | "measuredOn">,
  verifiedExcerpt: string,
  documentDate: string,
  context: Pick<SourceContext, "row" | "headings"> = ownContext(verifiedExcerpt),
): Check<{ analyte: "ferritin"; unit: string; refLow: number | null; refHigh: number | null; refText: string | null }> {
  const analyte = analyteFor(claim.analyteName);
  if (!analyte) return { ok: false, reason: `analyte "${claim.analyteName}" is not a tracked topic` };
  const aliases = ANALYTE_ALIASES[analyte];
  const quoted = normalize(verifiedExcerpt);
  if (!firstAlias(quoted, aliases)) return { ok: false, reason: "source excerpt does not name the analyte" };
  if (context.row === null) return { ok: false, reason: "the excerpt is not within one result line of the source" };

  const row = normalize(context.row);
  const hit = firstAlias(row, aliases)!;
  const lead = row.slice(0, hit.index).match(/[a-z0-9]+/g) ?? [];
  if (lead.some((w) => !RESULT_LEADS.has(w))) return { ok: false, reason: "the source line does not open with the analyte's name, so it is not that analyte's result" };
  const mentions = row.match(new RegExp(`(?<![a-z0-9])(?:${aliases.map(escapeRegExp).join("|")})(?![a-z0-9])`, "g")) ?? [];
  if (mentions.length > 1) return { ok: false, reason: "the source line names the analyte more than once" };
  if (QUALIFIER_SYMBOLS.test(row) || QUALIFIER_WORDS.some((w) => containsPhrase(row, w))) {
    return { ok: false, reason: "the source gives a bound or an approximation, not an exact value" };
  }
  const { dates, partial, rest } = readDates(row);
  if (partial) return { ok: false, reason: "the source line dates the result only partly, so its date is ambiguous" };
  if (new Set(dates).size > 1) return { ok: false, reason: "the source line holds more than one date" };
  const rejected = unitRejection(rest) ?? headingRejection(context.headings);
  if (rejected) return { ok: false, reason: rejected };

  // The value: the FIRST number + unit after the name, with nothing in between that could introduce another
  // test or value (only dates and linking words like "on", "level", "was").
  const afterStart = hit.index + hit.alias.length;
  const after = row.slice(afterStart);
  const numberRe = /(?<![\d.])(\d+(?:\.\d+)?)(?![\d])/g;
  let bound: { value: number; unit: string; end: number; gap: string } | null = null;
  for (let m = numberRe.exec(after); m; m = numberRe.exec(after)) {
    const sp = after[m.index + m[0].length] === " " ? 1 : 0;
    const tail = after.slice(m.index + m[0].length + sp);
    const unit = UNITS.find((u) => tail.startsWith(u) && !/^[a-z0-9]/.test(tail.slice(u.length)));
    if (unit) {
      bound = { value: Number(m[1]), unit, end: m.index + m[0].length + sp + unit.length, gap: after.slice(0, m.index) };
      break;
    }
  }
  if (!bound) return { ok: false, reason: "no value with a unit follows the analyte on its source line" };
  const gap = readDates(bound.gap).rest;
  if (/\d/.test(gap) || (gap.match(/[a-z]+/g) ?? []).some((w) => !RESULT_LINKERS.has(w))) {
    return { ok: false, reason: "the value is not written as the analyte's own result in the source" };
  }
  if (Math.abs(bound.value - claim.value) > 1e-9) {
    return { ok: false, reason: `source binds ${bound.value} to the analyte, not ${claim.value}` };
  }
  if (normalize(claim.unit) !== bound.unit) {
    return { ok: false, reason: `unit "${claim.unit}" does not match the source` };
  }
  // what the patient is shown must hold the name, the value and the unit
  const at = row.indexOf(quoted);
  const quoteEnd = at + quoted.length;
  if (at === -1 || at > hit.index || quoteEnd < afterStart + bound.end) {
    return { ok: false, reason: "the excerpt does not show the analyte with its value and unit" };
  }
  const unitOriginal = findOriginalSpan(verifiedExcerpt, bound.unit) ?? claim.unit;

  let refLow: number | null = null;
  let refHigh: number | null = null;
  let refText: string | null = null;
  if (claim.referenceRangeText) {
    const nums = normalize(claim.referenceRangeText).match(/\d+(?:\.\d+)?/g) ?? [];
    if (nums.length !== 2) return { ok: false, reason: "reference range is not two numbers" };
    // The range must belong to THIS result: it directly follows the value and unit ("32 μg/l 15-150",
    // "32 μg/l (reference range 15-150 μg/l)"). A range elsewhere is never borrowed.
    const label = "(?:(?:reference|ref\\.?|normal) (?:range|interval)|reference|range|ref\\.?|rr)";
    const rangeRe = new RegExp(`^ ?\\(? ?(?:${label} ?)?:? ?${escapeRegExp(nums[0])} ?- ?${escapeRegExp(nums[1])}(?![\\d.])`);
    const range = rangeRe.exec(after.slice(bound.end));
    if (!range) return { ok: false, reason: "the claimed reference range is not the one written with this result" };
    if (quoteEnd < afterStart + bound.end + range[0].length) {
      return { ok: false, reason: "the excerpt does not show the claimed reference range" };
    }
    refLow = Number(nums[0]);
    refHigh = Number(nums[1]);
    refText = `${nums[0]}–${nums[1]}`;
  }

  if (!isIsoDate(claim.measuredOn)) return { ok: false, reason: "measurement date is not a valid date" };
  const lineDate = dates[0] ?? null;
  if (claim.measuredOn !== (lineDate ?? documentDate)) {
    return {
      ok: false,
      reason: lineDate ? "measurement date is not the date written with this result" : "measurement date is not the document date, and the result line has no date of its own",
    };
  }
  return { ok: true, analyte, unit: unitOriginal, refLow, refHigh, refText };
}

/** Clauses of one source line: the status cue must sit in the same clause as the medication it is about. */
function clauses(line: string): string[] {
  return line.split(/,|\b(?:and|but|while|whereas|although|though|however|yet)\b/).map((c) => c.trim()).filter(Boolean);
}

/**
 * Medication: verified ONLY on the one source sentence that holds the excerpt (`context.sentence`); a sibling
 * sentence is never evidence. The excerpt must lie inside that sentence and itself name the medication with the
 * status cue in the same clause on the same line (that is what the patient is shown). The whole sentence is then
 * checked, and it fails closed when it:
 *  - asks a question, negates the status ("It is not true that …"), or makes it hypothetical, conditional,
 *    planned or recommended;
 *  - is about someone other than the patient ("Her mother is currently taking …");
 *  - describes an earlier time ("At the 27 Jan 2026 consultation …", "previously") or carries any date other
 *    than the document date — such a statement would otherwise be stored as if it held on the document date;
 *  - sits under a heading that makes it conditional, historical, uncertain or someone else's ("IF NEEDED").
 * "Current" also needs the patient as subject in the present tense (see `STATUS_CUES`).
 * Without a source context (direct calls), the excerpt is its own source.
 */
export function verifyMedicationFact(
  claim: Pick<ExtractedMedication, "medicationName" | "status">,
  verifiedExcerpt: string,
  episodes: MedicationEpisode[],
  documentDate: string,
  context: Pick<SourceContext, "sentence" | "headings"> = ownContext(verifiedExcerpt),
): Check<{ episodeId: string; status: MedicationStatus }> {
  const status = toStatus(claim.status);
  if (!status) return { ok: false, reason: `unknown status "${claim.status}"` };
  const episodeId = episodeFor(claim.medicationName, episodes);
  if (!episodeId) return { ok: false, reason: `medication "${claim.medicationName}" is not a tracked episode` };

  const aliases = MEDICATION_ALIASES[episodeId];
  const names = (s: string) => aliases.some((a) => containsPhrase(s, a));
  const cues = (s: string) => STATUS_CUES[status].some((re) => re.test(s));
  const quoted = normalize(verifiedExcerpt);
  if (!names(quoted)) return { ok: false, reason: "source excerpt does not name the medication" };
  if (!cues(quoted)) return { ok: false, reason: `no "${status}" cue in the source excerpt` };
  if (context.sentence === null) return { ok: false, reason: "the excerpt is not within one sentence of the source" };
  const sameClause = verifiedExcerpt.split("\n").some((line) => clauses(normalize(line)).some((c) => names(c) && cues(c)));
  if (!sameClause) return { ok: false, reason: `no "${status}" cue in the same clause as the medication` };

  const { dates, partial, rest } = readDates(normalize(context.sentence));
  if (partial || dates.some((d) => d !== documentDate)) {
    return { ok: false, reason: "the source dates this statement other than the document date, so it may not hold on the document date" };
  }
  const rejected = unitRejection(rest) ?? headingRejection(context.headings);
  if (rejected) return { ok: false, reason: rejected };
  return { ok: true, episodeId, status };
}

/**
 * Document date: the claimed date must be THE date code derives from the document header (`headerDocumentDate`).
 * A date that merely occurs in the document — earlier blood results, a previous report, a historical
 * consultation section — never verifies.
 */
export function verifyDocumentDate(documentDate: string, pages: string | string[]): Check {
  if (!isIsoDate(documentDate)) return { ok: false, reason: "document date is not a valid date" };
  const header = headerDocumentDate((Array.isArray(pages) ? pages[0] : pages) ?? "");
  if (!header.ok) return header;
  if (header.date !== documentDate) {
    return { ok: false, reason: `the document header gives ${header.date} as the document's date, not ${documentDate}` };
  }
  return { ok: true };
}

/** Follow-up (seed): recommendation cue + target alias + interval, all in the excerpt. */
export function verifyFollowUpFact(fu: FollowUp, verifiedExcerpt: string): Check {
  const n = normalize(verifiedExcerpt);
  if (!FOLLOW_UP_CUES.some((re) => re.test(n))) return { ok: false, reason: "no follow-up cue in the excerpt" };
  const aliases =
    "analyte" in fu.target ? ANALYTE_ALIASES[fu.target.analyte] : (EXAM_ALIASES[fu.target.examName] ?? []);
  if (!aliases.some((a) => containsPhrase(n, a))) return { ok: false, reason: "excerpt does not name the follow-up target" };
  if (fu.intervalText && !n.includes(normalize(fu.intervalText))) {
    return { ok: false, reason: `interval "${fu.intervalText}" is not in the excerpt` };
  }
  if (!n.includes(normalize(fu.recommendation))) {
    return { ok: false, reason: "stored recommendation wording is not in the excerpt" };
  }
  return { ok: true };
}

/** Imaging exam (seed): exam alias + date + statement; a comparison link needs cue + earlier date. */
export function verifyImagingFact(
  exam: ImagingExam,
  verifiedExcerpt: string,
  documentsById: Map<string, DocumentRecord>,
): Check {
  const n = normalize(verifiedExcerpt);
  const aliases = EXAM_ALIASES[exam.examName] ?? [];
  if (!aliases.some((a) => containsPhrase(n, a))) return { ok: false, reason: "excerpt does not name the examination" };
  if (!mentionsDate(n, exam.performedOn)) return { ok: false, reason: "examination date is not in the excerpt" };
  if (!n.includes(normalize(exam.statement))) return { ok: false, reason: "stored statement is not in the excerpt" };
  if (exam.comparesToDocumentId) {
    const earlier = documentsById.get(exam.comparesToDocumentId);
    if (!earlier) return { ok: false, reason: "comparison target document does not exist" };
    if (!COMPARISON_CUES.some((re) => re.test(n))) return { ok: false, reason: "no comparison wording in the excerpt" };
    if (!mentionsDate(n, earlier.date)) return { ok: false, reason: "earlier examination date is not in the excerpt" };
  }
  return { ok: true };
}

// ─── Live pipeline: verify one model extraction ───────────────────────────────────────────
export type Exclusion = { kind: "lab" | "medication"; reason: string };

export type VerificationOutcome =
  | { status: "unusable"; code: "no_candidate_facts" | "document_date_unverified" | "none_verified"; reason: string }
  | {
      status: "ok";
      documentDate: string;
      documentType: string;
      verified: ProposedFact[];
      excludedCount: number;
      exclusions: Exclusion[];
    };

export function verifyExtraction(
  pages: string[],
  extraction: Extraction,
  ctx: { documentId: string; episodes: MedicationEpisode[] },
): VerificationOutcome {
  const doc = extraction.document;
  // Subject gate: a candidate counts as a supported fact only if it names a supported subject
  // (ferritin / a supported medication episode) AND the document text itself names that subject.
  // Anything else is out of scope, not a failed verification, and is silently ignored.
  const docText = normalize(pages.join("\n"));
  const labs = extraction.labMeasurements.filter((lab) => {
    const analyte = analyteFor(lab.analyteName);
    return analyte !== null && ANALYTE_ALIASES[analyte].some((a) => containsPhrase(docText, a));
  });
  const meds = extraction.medicationStatements.filter((med) => {
    const ep = episodeFor(med.medicationName, ctx.episodes);
    return ep !== null && (MEDICATION_ALIASES[ep] ?? []).some((a) => containsPhrase(docText, a));
  });
  if (labs.length === 0 && meds.length === 0) {
    return { status: "unusable", code: "no_candidate_facts", reason: "no candidate names a supported subject found in the document" };
  }
  // The document date is derived by code from the header; the model's date must be that date, and its excerpt the
  // header line that states it.
  const undated = (reason: string): VerificationOutcome => ({ status: "unusable", code: "document_date_unverified", reason: `document date: ${reason}` });
  const docDate = verifyDocumentDate(doc.documentDate, pages);
  if (!docDate.ok) return undated(docDate.reason);
  const docLoc = locateExcerpt(pages, doc.page, doc.excerpt);
  if (!docLoc.ok) return undated(docLoc.reason);
  const header = headerDocumentDate(pages[0]);
  if (doc.page !== 1 || !header.ok || !header.lines.some((l) => docLoc.from >= l.from && docLoc.to <= l.to)) {
    return undated("the excerpt is not the header line that states the document date");
  }

  const verified: ProposedFact[] = [];
  const exclusions: Exclusion[] = [];

  labs.forEach((lab, i) => {
    const loc = locateExcerpt(pages, lab.page, lab.excerpt);
    if (!loc.ok) return void exclusions.push({ kind: "lab", reason: loc.reason });
    const check = verifyLabFact(lab, loc.verifiedExcerpt, doc.documentDate, loc.context);
    if (!check.ok) return void exclusions.push({ kind: "lab", reason: check.reason });
    verified.push({
      id: `${ctx.documentId}-lab-${i + 1}`,
      kind: "lab_measurement",
      topic: "iron",
      analyte: check.analyte,
      value: lab.value,
      unit: check.unit,
      refLow: check.refLow,
      refHigh: check.refHigh,
      refText: check.refText,
      measuredOn: lab.measuredOn,
      source: { documentId: ctx.documentId, page: lab.page, verifiedExcerpt: loc.verifiedExcerpt },
      review: "PROPOSED",
    });
  });

  meds.forEach((med, i) => {
    const loc = locateExcerpt(pages, med.page, med.excerpt);
    if (!loc.ok) return void exclusions.push({ kind: "medication", reason: loc.reason });
    const check = verifyMedicationFact(med, loc.verifiedExcerpt, ctx.episodes, doc.documentDate, loc.context);
    if (!check.ok) return void exclusions.push({ kind: "medication", reason: check.reason });
    verified.push({
      id: `${ctx.documentId}-med-${i + 1}`,
      kind: "medication_status",
      episodeId: check.episodeId,
      status: check.status,
      documentedOn: doc.documentDate,
      source: { documentId: ctx.documentId, page: med.page, verifiedExcerpt: loc.verifiedExcerpt },
      review: "PROPOSED",
    });
  });

  if (verified.length === 0) {
    return { status: "unusable", code: "none_verified", reason: "no extracted fact could be verified against the source" };
  }
  return {
    status: "ok",
    documentDate: doc.documentDate,
    documentType: doc.documentType,
    verified,
    excludedCount: exclusions.length,
    exclusions,
  };
}

// ─── Seed verification: the same bar for hand-authored trusted state ──────────────────────
export type SeedFailure = { factId: string; page: number; check: string };

export function verifySeedState(state: TrustedState, pagesByDocId: Map<string, string[]>): SeedFailure[] {
  const failures: SeedFailure[] = [];
  const documentsById = new Map(state.documents.map((d) => [d.id, d]));

  for (const doc of state.documents) {
    const pages = pagesByDocId.get(doc.id);
    if (!pages) {
      failures.push({ factId: doc.id, page: 0, check: "PDF missing or unreadable" });
      continue;
    }
    const dated = verifyDocumentDate(doc.date, pages);
    if (!dated.ok) failures.push({ factId: doc.id, page: 1, check: dated.reason });
  }

  for (const fact of state.facts) {
    const pages = pagesByDocId.get(fact.source.documentId);
    const fail = (check: string) => failures.push({ factId: fact.id, page: fact.source.page, check });
    if (!pages) {
      fail("source document missing");
      continue;
    }
    const loc = locateExcerpt(pages, fact.source.page, fact.source.verifiedExcerpt);
    if (!loc.ok) {
      fail(loc.reason);
      continue;
    }
    if (loc.verifiedExcerpt !== fact.source.verifiedExcerpt) {
      fail("stored excerpt is not exactly the canonical page text");
      continue;
    }
    const doc = documentsById.get(fact.source.documentId)!;
    let check: Check;
    switch (fact.kind) {
      case "lab_measurement":
        check = verifyLabFact(
          { analyteName: fact.analyte, value: fact.value, unit: fact.unit, referenceRangeText: fact.refText, measuredOn: fact.measuredOn },
          loc.verifiedExcerpt,
          doc.date,
          loc.context,
        );
        break;
      case "medication_status": {
        const ep = state.episodes.find((e) => e.id === fact.episodeId);
        const r = ep
          ? verifyMedicationFact({ medicationName: MEDICATION_ALIASES[ep.id]?.[0] ?? ep.name, status: fact.status }, loc.verifiedExcerpt, state.episodes, doc.date, loc.context)
          : ({ ok: false, reason: "episode does not exist" } as const);
        check = r.ok && r.episodeId !== fact.episodeId ? { ok: false, reason: "excerpt names a different episode" } : r;
        break;
      }
      case "follow_up":
        check = verifyFollowUpFact(fact, loc.verifiedExcerpt);
        break;
      case "imaging_exam":
        check = verifyImagingFact(fact, loc.verifiedExcerpt, documentsById);
        break;
    }
    if (!check.ok) fail(check.reason);
  }
  return failures;
}
