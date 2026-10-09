/**
 * Fact Verifier — THE TRUST GATE. Pure, deterministic code. Spec: `spec.md > Fact Verifier`.
 *
 * The model's excerpt is only a search key. Step A finds its ONE occurrence on the stated page, cuts the canonical
 * `verifiedExcerpt` out of the ORIGINAL page text, and determines the complete source unit around it. Step B accepts
 * a fact only when that complete unit matches a supported structure (`grammar.ts`) that directly establishes exactly
 * that fact — a deliberately narrow positive grammar, not language understanding. Anything else fails closed.
 *
 * Every comparison here — locating the excerpt included — uses the SOURCE-FAITHFUL normalization (`normalizeSource`):
 * no Unicode compatibility folding, so a numeric notation outside the grammar ("10³", "½", "③", full-width digits)
 * stays outside it and can never be read as a different, supported number.
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
import { findOriginalRanges, findOriginalSpan, normalizeSource } from "@/lib/text/normalize";
import { formatDate, isIsoDate } from "@/lib/text/dates";
import {
  ANALYTE_ALIASES,
  COMPARISON_CUES,
  EXAM_ALIASES,
  FOLLOW_UP_CUES,
  MEDICATION_ALIASES,
  containsPhrase,
} from "@/lib/extraction/lexicon";
import {
  FACT_SECTIONS,
  FERRITIN_ROW,
  FERRITIN_SENTENCE,
  HEADER_DATE_INTRO,
  HEADER_DATE_LINE,
  KNOWN_SECTIONS,
  TABLE_HEADER,
  TABLE_NOTE,
  TABLE_ROW,
  isoFromDate,
  medicationStatusGrammar,
} from "@/lib/extraction/grammar";

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

// ─── Step A: locate the one occurrence + its complete source unit ─────────────────────────
/**
 * The AUTHORITATIVE source units around a located excerpt. The model only supplies a search key: code finds the
 * single place it occurs and decides the units around it, so the model's excerpt boundaries never set the semantic
 * boundary, and a neighbouring sentence is never evidence.
 *  - `sentence`: the complete source sentence holding the excerpt (it may wrap over lines; a heading or a blank line
 *    ends it). `null` when the excerpt runs across a sentence end, a heading or a blank line.
 *  - `sentenceOwnsLines`: that sentence occupies whole lines — nothing else shares a line with it.
 *  - `line`: the complete physical source line holding the excerpt. `null` when the excerpt runs across lines.
 *  - `pageLines` / `lineIndex`: the page's lines and the index of `line` (a table row is read with its table).
 *  - `headings`: the heading lines above the excerpt in the document, nearest last.
 */
export type SourceContext = {
  sentence: string | null;
  sentenceOwnsLines: boolean;
  line: string | null;
  pageLines: string[];
  lineIndex: number;
  headings: string[];
};

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

/** A heading line ("MEDICATION HISTORY", "RESULTS"): no lowercase letters and no trailing ",", ":" or ";". */
const isHeading = (line: string) => line.trim() !== "" && !/[a-z]/.test(line) && !/[,:;]\s*$/.test(line);
/** A heading or a blank line: no sentence runs across one. */
const isBoundaryLine = (line: string) => line.trim() === "" || isHeading(line);

/** [from, to) of the source line holding offset `i` (a "\n" belongs to the line it ends). */
function lineAt(text: string, i: number): { from: number; to: number } {
  const nl = text.indexOf("\n", i);
  return { from: text.lastIndexOf("\n", i - 1) + 1, to: nl === -1 ? text.length : nl };
}

/** The complete source units around [from, to) on `pages[page - 1]` (see `SourceContext`). */
export function sourceContext(pages: string[], page: number, from: number, to: number): SourceContext {
  const text = pages[page - 1];
  const first = lineAt(text, from);
  const last = lineAt(text, Math.max(from, to - 1));
  const pageLines = text.split("\n");
  const lineIndex = text.slice(0, first.from).split("\n").length - 1;
  const line = first.from === last.from ? text.slice(first.from, first.to).trim() : null;
  const headings = [...pages.slice(0, page - 1), text.slice(0, first.from)]
    .flatMap((p) => p.split("\n"))
    .filter(isHeading)
    .map((h) => h.trim());
  const noSentence = { sentence: null, sentenceOwnsLines: false, line, pageLines, lineIndex, headings };
  if (text.slice(first.from, last.to).split("\n").some(isBoundaryLine)) return noSentence;

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
  if (to > end) return noSentence; // the excerpt runs into the next sentence
  const s0 = start + (text.slice(start, end).length - text.slice(start, end).trimStart().length);
  const e0 = end - (text.slice(start, end).length - text.slice(start, end).trimEnd().length);
  const sentenceOwnsLines =
    text.slice(lineAt(text, s0).from, s0).trim() === "" && text.slice(e0, lineAt(text, Math.max(s0, e0 - 1)).to).trim() === "";
  return { sentence: text.slice(start, end).trim(), sentenceOwnsLines, line, pageLines, lineIndex, headings };
}

/**
 * Find the ONE place the excerpt occurs on the stated page. An excerpt that occurs more than once does not say
 * which statement it is, so it fails closed.
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
  const ranges = findOriginalRanges(text, excerpt, "source");
  if (ranges.length === 0) return { ok: false, reason: `excerpt not found on page ${page}` };
  if (ranges.length > 1) {
    return { ok: false, reason: `excerpt occurs ${ranges.length} times on page ${page}, so which statement it is cannot be told` };
  }
  const { from, to } = ranges[0];
  return { ok: true, verifiedExcerpt: text.slice(from, to), from, to, context: sourceContext(pages, page, from, to) };
}

// ─── helpers ──────────────────────────────────────────────────────────────────────────────
function mentionsDate(n: string, iso: string): boolean {
  return n.includes(normalizeSource(formatDate(iso))) || n.includes(iso);
}

function analyteFor(name: string): "ferritin" | null {
  const n = normalizeSource(name);
  for (const [key, aliases] of Object.entries(ANALYTE_ALIASES)) {
    if (aliases.some((a) => containsPhrase(n, a))) return key as "ferritin";
  }
  return null;
}

function episodeFor(name: string, episodes: MedicationEpisode[]): string | null {
  const n = normalizeSource(name);
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
  return map[normalizeSource(s)] ?? null;
}

/** The excerpt is the complete unit (a missing final full stop aside): what the patient sees is the whole evidence. */
const isWholeUnit = (excerpt: string, unit: string) => normalizeSource(excerpt).replace(/\.$/, "") === normalizeSource(unit).replace(/\.$/, "");

/**
 * The document structure around a fact: every heading above it must be one of the corpus's ordinary sections, and
 * the fact's own section (its nearest heading, not counting a table's column header) must be one where this kind
 * of fact is supported. Any other heading ("IF NEEDED", "HISTORICAL CONSULTATION", "PLAN") fails closed.
 */
function sectionProblem(headings: string[], kind: "medication" | "ferritin"): string | null {
  const unknown = headings.find((h) => !KNOWN_SECTIONS.includes(normalizeSource(h)));
  if (unknown) return `it sits below the heading "${unknown}", which is not a supported section`;
  const section = headings.map(normalizeSource).filter((h) => h !== TABLE_HEADER).pop();
  if (!section || !FACT_SECTIONS[kind].includes(section)) return `it is not in a supported ${kind} section`;
  return null;
}

/**
 * A table row counts only inside a supported laboratory table: above it, only well-formed rows up to the column
 * header; below it, only well-formed rows until the table ends (end of page, a blank line, a heading or the closing
 * reference-range note). A line that continues or qualifies the row makes the table unsupported.
 */
function inLabTable(lines: string[], i: number): boolean {
  const at = (k: number) => normalizeSource(lines[k]);
  let up = i - 1;
  while (up >= 0 && TABLE_ROW.test(at(up))) up--;
  if (up < 0 || at(up) !== TABLE_HEADER) return false;
  let down = i + 1;
  while (down < lines.length && TABLE_ROW.test(at(down))) down++;
  return down === lines.length || lines[down].trim() === "" || isHeading(lines[down]) || TABLE_NOTE.test(at(down));
}

// ─── Step B: the complete source unit must match a supported structure ────────────────────

/**
 * Lab (ferritin): the excerpt must be the complete physical result line, and that line must be one of the
 * supported structures in full (`grammar.ts`) — a result sentence on its own line, or a row of a supported
 * laboratory table. Identity, the one exact value, its unit, the optional supplied range and the optional date all
 * come from that one parse; the document date is used only when the line has no date of its own. A second value or
 * range, a correction, a comparator or a qualifier is simply not part of the grammar, so it fails.
 */
export function verifyLabFact(
  claim: Pick<ExtractedLab, "analyteName" | "value" | "unit" | "referenceRangeText" | "measuredOn">,
  verifiedExcerpt: string,
  documentDate: string,
  context: Pick<SourceContext, "sentence" | "line" | "pageLines" | "lineIndex" | "headings">,
): Check<{ analyte: "ferritin"; unit: string; refLow: number | null; refHigh: number | null; refText: string | null }> {
  const analyte = analyteFor(claim.analyteName);
  if (!analyte) return { ok: false, reason: `analyte "${claim.analyteName}" is not a tracked topic` };
  if (context.line === null) return { ok: false, reason: "the excerpt is not within one line of the source" };
  if (!isWholeUnit(verifiedExcerpt, context.line)) return { ok: false, reason: "the excerpt is not the complete source result line" };

  const line = normalizeSource(context.line);
  let parsed = FERRITIN_SENTENCE.exec(line)?.groups;
  if (parsed) {
    // a result sentence must be complete on its line: nothing of it on an earlier line ("Approximately\nFerritin …")
    if (context.sentence === null || normalizeSource(context.sentence) !== line) {
      return { ok: false, reason: "the result line is not a complete sentence of its own" };
    }
  } else {
    parsed = FERRITIN_ROW.exec(line)?.groups;
    if (!parsed) return { ok: false, reason: "the source line is not a supported ferritin result (one exact value, its unit and at most one range)" };
    if (!inLabTable(context.pageLines, context.lineIndex)) return { ok: false, reason: "the result row is not part of a supported laboratory table" };
  }
  const section = sectionProblem(context.headings, "ferritin");
  if (section) return { ok: false, reason: section };

  if (Number(parsed.value) !== claim.value) return { ok: false, reason: `the source gives ${parsed.value}, not ${claim.value}` };
  if (normalizeSource(claim.unit) !== parsed.unit) return { ok: false, reason: `unit "${claim.unit}" does not match the source` };
  if (parsed.rangeUnit && parsed.rangeUnit !== parsed.unit) return { ok: false, reason: "the supplied range is in a different unit" };

  let refLow: number | null = null;
  let refHigh: number | null = null;
  let refText: string | null = null;
  if (claim.referenceRangeText) {
    const nums = normalizeSource(claim.referenceRangeText).match(/\d+(?:\.\d+)?/g) ?? [];
    if (nums.length !== 2) return { ok: false, reason: "reference range is not two numbers" };
    if (!parsed.low || Number(nums[0]) !== Number(parsed.low) || Number(nums[1]) !== Number(parsed.high)) {
      return { ok: false, reason: "the claimed reference range is not the one written with this result" };
    }
    refLow = Number(parsed.low);
    refHigh = Number(parsed.high);
    refText = `${parsed.low}–${parsed.high}`;
  }

  if (!isIsoDate(claim.measuredOn)) return { ok: false, reason: "measurement date is not a valid date" };
  const lineDate = parsed.day ? isoFromDate(parsed) : null;
  if (parsed.day && !lineDate) return { ok: false, reason: "the result line gives an impossible date" };
  if (claim.measuredOn !== (lineDate ?? documentDate)) {
    return {
      ok: false,
      reason: lineDate ? "measurement date is not the date written with this result" : "measurement date is not the document date, and the result line has no date of its own",
    };
  }
  return { ok: true, analyte, unit: findOriginalSpan(verifiedExcerpt, parsed.unit, "source") ?? claim.unit, refLow, refHigh, refText };
}

/**
 * Medication (oral iron): the excerpt must be the complete source sentence, and that sentence must be one of the
 * supported structures for the claimed status (`medicationStatusGrammar`): the status verb bound directly to oral
 * iron, and — where a person is named — the patient as the subject. "The patient is currently taking vitamin D
 * instead of oral iron", "Her niece completed oral iron", a question, a negation, a condition or an earlier date
 * are simply not supported structures, so they fail. The sentence must occupy whole lines of its own (nothing on its
 * line can qualify it) and sit in a supported medication section.
 */
export function verifyMedicationFact(
  claim: Pick<ExtractedMedication, "medicationName" | "status">,
  verifiedExcerpt: string,
  episodes: MedicationEpisode[],
  context: Pick<SourceContext, "sentence" | "sentenceOwnsLines" | "headings">,
): Check<{ episodeId: string; status: MedicationStatus }> {
  const status = toStatus(claim.status);
  if (!status) return { ok: false, reason: `unknown status "${claim.status}"` };
  const episodeId = episodeFor(claim.medicationName, episodes);
  if (!episodeId) return { ok: false, reason: `medication "${claim.medicationName}" is not a tracked episode` };
  if (context.sentence === null) return { ok: false, reason: "the excerpt is not within one sentence of the source" };
  if (!context.sentenceOwnsLines) return { ok: false, reason: "the source sentence shares its line with other text" };
  if (!isWholeUnit(verifiedExcerpt, context.sentence)) return { ok: false, reason: "the excerpt is not the complete source sentence" };

  const sentence = normalizeSource(context.sentence);
  if (!medicationStatusGrammar(episodeId)[status].some((re) => re.test(sentence))) {
    return { ok: false, reason: `the source sentence is not a supported "${status}" statement about the patient's oral iron` };
  }
  const section = sectionProblem(context.headings, "medication");
  if (section) return { ok: false, reason: section };
  return { ok: true, episodeId, status };
}

/**
 * THE document date, derived by code from the document header: the lines of page 1 above the first section
 * heading. A header line that sets out to give a document date must be a complete supported header line
 * (`HEADER_DATE_LINE`: label, optional colon, one date, nothing else), or the header fails closed. Exactly one date
 * must result. A later section ("HISTORICAL CONSULTATION / Consultation date: 27 Jan 2026") is below a heading, so
 * it can never be — or override — the document date. Returns the date and the header line(s) stating it.
 */
export function headerDocumentDate(firstPage: string): Check<{ date: string; lines: { from: number; to: number }[] }> {
  const found: { date: string; from: number; to: number }[] = [];
  let offset = 0;
  for (const line of firstPage.split("\n")) {
    const from = offset;
    offset += line.length + 1;
    if (isHeading(line)) break; // the header ends at the first section heading
    const n = normalizeSource(line);
    if (!HEADER_DATE_INTRO.test(n)) continue;
    const date = isoFromDate(HEADER_DATE_LINE.exec(n)?.groups);
    if (!date) return { ok: false, reason: "a header date line is not in the supported form (label, one date, nothing else)" };
    found.push({ date, from, to: from + line.length });
  }
  const distinct = [...new Set(found.map((f) => f.date))];
  if (distinct.length === 0) return { ok: false, reason: "the document header does not state the document's date" };
  if (distinct.length > 1) return { ok: false, reason: "the document header states more than one document date" };
  return { ok: true, date: distinct[0], lines: found.map(({ from, to }) => ({ from, to })) };
}

/** Document date: the claimed date must be THE date code derives from the document header (`headerDocumentDate`). */
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
  const n = normalizeSource(verifiedExcerpt);
  if (!FOLLOW_UP_CUES.some((re) => re.test(n))) return { ok: false, reason: "no follow-up cue in the excerpt" };
  const aliases =
    "analyte" in fu.target ? ANALYTE_ALIASES[fu.target.analyte] : (EXAM_ALIASES[fu.target.examName] ?? []);
  if (!aliases.some((a) => containsPhrase(n, a))) return { ok: false, reason: "excerpt does not name the follow-up target" };
  if (fu.intervalText && !n.includes(normalizeSource(fu.intervalText))) {
    return { ok: false, reason: `interval "${fu.intervalText}" is not in the excerpt` };
  }
  if (!n.includes(normalizeSource(fu.recommendation))) {
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
  const n = normalizeSource(verifiedExcerpt);
  const aliases = EXAM_ALIASES[exam.examName] ?? [];
  if (!aliases.some((a) => containsPhrase(n, a))) return { ok: false, reason: "excerpt does not name the examination" };
  if (!mentionsDate(n, exam.performedOn)) return { ok: false, reason: "examination date is not in the excerpt" };
  if (!n.includes(normalizeSource(exam.statement))) return { ok: false, reason: "stored statement is not in the excerpt" };
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
  const docText = normalizeSource(pages.join("\n"));
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
    const check = verifyMedicationFact(med, loc.verifiedExcerpt, ctx.episodes, loc.context);
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
          ? verifyMedicationFact({ medicationName: MEDICATION_ALIASES[ep.id]?.[0] ?? ep.name, status: fact.status }, loc.verifiedExcerpt, state.episodes, loc.context)
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
