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
import { findOriginalSpan, normalize } from "@/lib/text/normalize";
import { formatDate, isIsoDate } from "@/lib/text/dates";
import {
  ANALYTE_ALIASES,
  COMPARISON_CUES,
  EXAM_ALIASES,
  FOLLOW_UP_CUES,
  MEDICATION_ALIASES,
  STATUS_CUES,
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

// ─── Step A: locate + canonicalise ────────────────────────────────────────────────────────
export function locateExcerpt(pages: string[], page: number, excerpt: string): Check<{ verifiedExcerpt: string }> {
  if (!Number.isInteger(page) || page < 1 || page > pages.length) {
    return { ok: false, reason: `page ${page} does not exist` };
  }
  const span = findOriginalSpan(pages[page - 1], excerpt);
  if (!span) return { ok: false, reason: `excerpt not found on page ${page}` };
  return { ok: true, verifiedExcerpt: span };
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

function sentences(n: string): string[] {
  return n.split(/(?<=[.!?;])\s+/).filter(Boolean);
}

// ─── Step B: semantic checkers (all evaluated on verifiedExcerpt) ─────────────────────────

/** Lab: analyte alias in source + value bound to it + unit + range + date. */
export function verifyLabFact(
  claim: Pick<ExtractedLab, "analyteName" | "value" | "unit" | "referenceRangeText" | "measuredOn">,
  verifiedExcerpt: string,
  documentDate: string,
): Check<{ analyte: "ferritin"; unit: string; refLow: number | null; refHigh: number | null; refText: string | null }> {
  const analyte = analyteFor(claim.analyteName);
  if (!analyte) return { ok: false, reason: `analyte "${claim.analyteName}" is not a tracked topic` };

  const n = normalize(verifiedExcerpt);
  const hit = firstAlias(n, ANALYTE_ALIASES[analyte]);
  if (!hit) return { ok: false, reason: "source excerpt does not name the analyte" };

  // Value bound to analyte: the FIRST number + unit that follows the alias.
  const after = n.slice(hit.index + hit.alias.length);
  const numberRe = /(?<![\d.])(\d+(?:\.\d+)?)(?![\d])/g;
  let bound: { value: number; unit: string; restAfterUnit: string } | null = null;
  for (let m = numberRe.exec(after); m; m = numberRe.exec(after)) {
    const rest = after.slice(m.index + m[0].length).replace(/^ /, "");
    const unit = UNITS.find((u) => rest.startsWith(u) && !/^[a-z0-9]/.test(rest.slice(u.length)));
    if (unit) {
      bound = { value: Number(m[1]), unit, restAfterUnit: rest.slice(unit.length) };
      break;
    }
  }
  if (!bound) return { ok: false, reason: "no value with a unit follows the analyte in the source" };
  if (Math.abs(bound.value - claim.value) > 1e-9) {
    return { ok: false, reason: `source binds ${bound.value} to the analyte, not ${claim.value}` };
  }
  if (normalize(claim.unit) !== bound.unit) {
    return { ok: false, reason: `unit "${claim.unit}" does not match the source` };
  }
  const unitOriginal = findOriginalSpan(verifiedExcerpt, bound.unit) ?? claim.unit;

  let refLow: number | null = null;
  let refHigh: number | null = null;
  let refText: string | null = null;
  if (claim.referenceRangeText) {
    const nums = normalize(claim.referenceRangeText).match(/\d+(?:\.\d+)?/g) ?? [];
    if (nums.length !== 2) return { ok: false, reason: "reference range is not two numbers" };
    const rangeRe = new RegExp(`(?<![\\d.])${escapeRegExp(nums[0])} ?- ?${escapeRegExp(nums[1])}(?![\\d])`);
    if (!rangeRe.test(bound.restAfterUnit)) {
      return { ok: false, reason: "reference range does not appear after the value in the source" };
    }
    refLow = Number(nums[0]);
    refHigh = Number(nums[1]);
    refText = `${nums[0]}–${nums[1]}`;
  }

  if (!isIsoDate(claim.measuredOn)) return { ok: false, reason: "measurement date is not a valid date" };
  if (!mentionsDate(n, claim.measuredOn) && claim.measuredOn !== documentDate) {
    return { ok: false, reason: "measurement date is neither in the excerpt nor the document date" };
  }
  return { ok: true, analyte, unit: unitOriginal, refLow, refHigh, refText };
}

/** Medication: episode alias AND status cue in the SAME sentence of the source excerpt. */
export function verifyMedicationFact(
  claim: Pick<ExtractedMedication, "medicationName" | "status">,
  verifiedExcerpt: string,
  episodes: MedicationEpisode[],
): Check<{ episodeId: string; status: MedicationStatus }> {
  const status = toStatus(claim.status);
  if (!status) return { ok: false, reason: `unknown status "${claim.status}"` };
  const episodeId = episodeFor(claim.medicationName, episodes);
  if (!episodeId) return { ok: false, reason: `medication "${claim.medicationName}" is not a tracked episode` };

  const aliases = MEDICATION_ALIASES[episodeId];
  const sents = sentences(normalize(verifiedExcerpt));
  const named = sents.filter((s) => aliases.some((a) => containsPhrase(s, a)));
  if (named.length === 0) return { ok: false, reason: "source excerpt does not name the medication" };
  const cued = named.some((s) => STATUS_CUES[status].some((re) => re.test(s)));
  if (!cued) return { ok: false, reason: `no "${status}" cue in the same sentence as the medication` };
  return { ok: true, episodeId, status };
}

/** Document date: must appear in the located excerpt. */
export function verifyDocumentDate(documentDate: string, verifiedExcerpt: string): Check {
  if (!isIsoDate(documentDate)) return { ok: false, reason: "document date is not a valid date" };
  if (!mentionsDate(normalize(verifiedExcerpt), documentDate)) {
    return { ok: false, reason: "document date does not appear in the excerpt" };
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
  if (extraction.labMeasurements.length === 0 && extraction.medicationStatements.length === 0) {
    return { status: "unusable", code: "no_candidate_facts", reason: "the model proposed no facts of a supported type" };
  }
  const docLoc = locateExcerpt(pages, doc.page, doc.excerpt);
  if (!docLoc.ok) return { status: "unusable", code: "document_date_unverified", reason: `document date: ${docLoc.reason}` };
  const docDate = verifyDocumentDate(doc.documentDate, docLoc.verifiedExcerpt);
  if (!docDate.ok) return { status: "unusable", code: "document_date_unverified", reason: `document date: ${docDate.reason}` };

  const verified: ProposedFact[] = [];
  const exclusions: Exclusion[] = [];

  extraction.labMeasurements.forEach((lab, i) => {
    const loc = locateExcerpt(pages, lab.page, lab.excerpt);
    if (!loc.ok) return void exclusions.push({ kind: "lab", reason: loc.reason });
    const check = verifyLabFact(lab, loc.verifiedExcerpt, doc.documentDate);
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

  extraction.medicationStatements.forEach((med, i) => {
    const loc = locateExcerpt(pages, med.page, med.excerpt);
    if (!loc.ok) return void exclusions.push({ kind: "medication", reason: loc.reason });
    const check = verifyMedicationFact(med, loc.verifiedExcerpt, ctx.episodes);
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
    if (!pages.some((p) => mentionsDate(normalize(p), doc.date))) {
      failures.push({ factId: doc.id, page: 1, check: "document date does not appear in its own text" });
    }
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
        );
        break;
      case "medication_status": {
        const ep = state.episodes.find((e) => e.id === fact.episodeId);
        const r = ep
          ? verifyMedicationFact({ medicationName: MEDICATION_ALIASES[ep.id]?.[0] ?? ep.name, status: fact.status }, loc.verifiedExcerpt, state.episodes)
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
