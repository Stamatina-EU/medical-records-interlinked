/**
 * The shared lexicon: what the SOURCE TEXT must say for a claim to count as evidence.
 * Used by the live Fact Verifier and the Seed Verifier alike (`spec.md > Fact Verifier`).
 * All patterns are matched against normalized (lowercased) text.
 */
import type { MedicationEpisode, MedicationStatus } from "@/lib/model/types";

/** Accepted analyte aliases, longest first so "serum ferritin" wins over "ferritin". */
export const ANALYTE_ALIASES: Record<"ferritin", string[]> = {
  ferritin: ["serum ferritin", "ferritin"],
};

/** Aliases for the one medication episode in this POC. */
export const MEDICATION_ALIASES: Record<string, string[]> = {
  "ep-oral-iron": ["ferrous sulphate", "ferrous sulfate", "iron supplement", "iron tablets", "oral iron"],
};

/**
 * The supported medication episodes, owned by code (like the analyte aliases), so a first
 * verified status can be accepted into an EMPTY history: the episode is identified here and
 * created in the trusted state by `apply` when its first status fact is approved.
 */
export const MEDICATION_EPISODES: MedicationEpisode[] = [{ id: "ep-oral-iron", topic: "iron", name: "Oral iron (ferrous sulfate)" }];

/** Episodes a new fact may belong to: those already in the history plus the supported catalogue. */
export function knownEpisodes(existing: MedicationEpisode[]): MedicationEpisode[] {
  return [...existing, ...MEDICATION_EPISODES.filter((e) => !existing.some((x) => x.id === e.id))];
}

/**
 * Status cues. "Prescribed" deliberately matches only "prescribed:" or "was/is prescribed" —
 * NOT the adjective in "completed the prescribed course", which must not create a Prescribed claim.
 */
export const STATUS_CUES: Record<MedicationStatus, RegExp[]> = {
  Prescribed: [/\bprescribed:/, /\b(?:is|was|were|has been|have been) prescribed\b/],
  Current: [/\bcurrently taking\b/, /\bcontinues to take\b/],
  Completed: [/\bcompleted\b/, /\bfinished\b/],
  Stopped: [/\bstopped\b/, /\bdiscontinued\b/],
};

/**
 * A status is evidence only when it is stated as fact. Any of these words in the sentence that carries the cue
 * means the status is denied, hypothetical, planned or recommended — not documented — so the claim fails closed.
 */
export const NEGATION_WORDS: string[] = [
  "not", "no", "never", "none", "neither", "nor", "without", "cannot", "no longer",
  "denies", "denied", "declined", "refused", "refuses", "unable", "failed",
];
export const NON_FACTUAL_WORDS: string[] = [
  "if", "unless", "whether", "should", "would", "could", "may", "might", "must", "will", "shall",
  "consider", "considered", "considering", "plan", "plans", "planned", "planning", "intend", "intends", "intended",
  "propose", "proposed", "recommend", "recommends", "recommended", "advise", "advised", "suggest", "suggested",
  "expect", "expected", "likely", "possibly", "possible", "probably", "perhaps", "awaiting", "pending",
  "to be", "to start", "to stop", "to continue", "to complete",
];

/**
 * Labels that make a date THE document's own date ("Date of consultation 25 Sep 2026"). A date anywhere else in
 * the text — a result date, a referral date — is not the document date. "Date" alone counts only when the
 * excerpt starts with it ("Date: 3 Feb 2026").
 */
export const DOCUMENT_DATE_LABELS: string[] = [
  "date of consultation", "consultation date", "date of visit", "visit date", "clinic date", "date of service",
  "date of report", "report date", "reported on", "date issued", "date of issue", "issue date", "issued on",
  "date of examination", "examination date", "date of letter", "letter date", "document date",
];

export const FOLLOW_UP_CUES: RegExp[] = [/\brepeat\b/, /\brecheck\b/, /\bfollow-up\b/, /\brecommended\b/];

export const EXAM_ALIASES: Record<string, string[]> = {
  "Thyroid ultrasound": ["thyroid ultrasound", "ultrasound"],
};

export const COMPARISON_CUES: RegExp[] = [/\bcomparison\b/, /\bcompared with\b/];

/** Units recognised when binding a number to an analyte (normalized, lowercase). */
export const UNITS: string[] = ["μg/l", "ng/ml", "g/dl", "g/l", "mmol/l", "μmol/l", "x10^9/l", "%"];

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word/phrase containment on normalized text. */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}($|[^a-z0-9])`).test(normalizedText);
}
