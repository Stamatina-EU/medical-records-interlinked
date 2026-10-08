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
 * "Current" needs the patient as the subject and the present tense ("the patient is currently taking",
 * "the patient continues to take"): "was currently taking" or someone else's medication is never Current.
 */
export const STATUS_CUES: Record<MedicationStatus, RegExp[]> = {
  Prescribed: [/\bprescribed:/, /\b(?:is|was|were|has been|have been) prescribed\b/],
  Current: [/\b(?:the patient|patient|he|she) is currently taking\b/, /\b(?:the patient|patient|he|she) continues to take\b/],
  Completed: [/\bcompleted\b/, /\bfinished\b/],
  Stopped: [/\bstopped\b/, /\bdiscontinued\b/],
};

/**
 * A statement is evidence only when it is stated as fact, about the patient, at the document's own time. Any of
 * these words in its source assertion unit means the status is denied, hypothetical, planned or recommended, about
 * someone else, or about an earlier time — not documented — so the claim fails closed.
 */
export const NEGATION_WORDS: string[] = [
  "not", "no", "never", "none", "neither", "nor", "without", "cannot", "no longer",
  "denies", "denied", "declined", "refused", "refuses", "unable", "failed",
];
export const NON_FACTUAL_WORDS: string[] = [
  "if", "unless", "whether", "when", "should", "would", "could", "may", "might", "must", "will", "shall",
  "consider", "considered", "considering", "plan", "plans", "planned", "planning", "intend", "intends", "intended",
  "propose", "proposed", "recommend", "recommends", "recommended", "advise", "advised", "suggest", "suggested",
  "expect", "expected", "likely", "possibly", "possible", "probably", "perhaps", "awaiting", "pending",
  "aim", "target", "goal", "next", "tomorrow", "upcoming", "later", "as needed", "as required", "prn",
  "to be", "to start", "to stop", "to continue", "to complete",
];
/** Someone other than the patient. */
export const THIRD_PARTY_WORDS: string[] = [
  "mother", "father", "mum", "mom", "dad", "parent", "parents", "brother", "sister", "sibling", "siblings",
  "son", "daughter", "child", "children", "husband", "wife", "partner", "spouse", "grandmother", "grandfather",
  "grandparent", "grandparents", "aunt", "uncle", "cousin", "family", "relative", "relatives", "friend",
  "carer", "caregiver", "neighbour", "neighbor", "colleague", "another patient", "other patient", "other patients",
];
/** An earlier time than the document's own: the statement may no longer hold on the document date. */
export const HISTORICAL_WORDS: string[] = [
  "previously", "previous", "prior", "earlier", "formerly", "former", "used to", "in the past", "last", "ago",
  "yesterday", "history of", "at that time", "at the time", "had been", "initially", "originally", "baseline",
];
/** "At the 27 Jan 2026 consultation", "at her last visit": a statement framed at another consultation. */
export const HISTORICAL_FRAME = /\bat (?:the|that|an?|her|his|their)\b(?: [^ ]+){0,4} (?:consultation|visit|appointment|review|admission|clinic)\b/;

/**
 * Words that, in a heading ABOVE a statement, make the whole section non-evidence: conditional or planned
 * ("IF NEEDED", "PLAN"), historical ("PREVIOUS RESULTS", "PAST MEDICAL HISTORY"), about someone else
 * ("FAMILY HISTORY"), uncertain or negated. Headings can only reject; they are never evidence. "HISTORY" alone
 * (as in "MEDICATION HISTORY") is deliberately not on the list.
 */
export const HEADING_REJECT_WORDS: string[] = [
  ...NEGATION_WORDS, ...NON_FACTUAL_WORDS, ...THIRD_PARTY_WORDS,
  "historical", "previous", "previously", "prior", "past", "earlier", "former", "formerly", "old", "archive",
  "archived", "baseline", "comparison", "needed", "recommendation", "recommendations", "advice", "options",
  "future", "instructions", "goals", "targets", "question", "questions", "query", "queries", "unconfirmed",
  "uncertain", "unknown", "unverified", "differential", "suspected",
];

/**
 * A result is an exact scalar only. Any of these in the result line — before or after the value, inside the quote
 * or not — makes it a bound or an approximation (">150", "150 (or more)", "approximately 32"), never a value.
 */
export const QUALIFIER_SYMBOLS = /[<>≤≥≦≧~≈±]|\+\/-|\d ?\+/;
export const QUALIFIER_WORDS: string[] = [
  "approximately", "approx", "about", "around", "roughly", "circa", "ca", "nearly", "almost", "estimated", "est",
  "more than", "less than", "greater than", "lower than", "higher than", "fewer than", "above", "below", "over",
  "under", "up to", "at least", "at most", "exceeds", "exceeding", "in excess of", "between",
  "or more", "or less", "or above", "or below", "or greater", "or higher", "or lower", "or over", "or under",
];

/**
 * The only labels that may introduce THE document's own date, and only on a header line of page 1 (before the
 * first section heading) that BEGINS with the label: "Date of consultation 25 Sep 2026", "Report date …",
 * "Date issued …", "Examination date …", "Date: …". A qualified label ("Previous report date"), a result,
 * sample or collection date, or a date in a later section ("HISTORICAL CONSULTATION / Consultation date …")
 * is never the document date.
 */
export const DOCUMENT_DATE_LABELS: string[] = [
  "date", "date of consultation", "consultation date", "report date", "date of report",
  "date issued", "date of issue", "examination date", "date of examination",
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
