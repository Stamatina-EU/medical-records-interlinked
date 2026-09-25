/**
 * The shared lexicon: what the SOURCE TEXT must say for a claim to count as evidence.
 * Used by the live Fact Verifier and the Seed Verifier alike (`spec.md > Fact Verifier`).
 * All patterns are matched against normalized (lowercased) text.
 */
import type { MedicationStatus } from "@/lib/model/types";

/** Accepted analyte aliases, longest first so "serum ferritin" wins over "ferritin". */
export const ANALYTE_ALIASES: Record<"ferritin", string[]> = {
  ferritin: ["serum ferritin", "ferritin"],
};

/** Aliases for the one medication episode in this POC. */
export const MEDICATION_ALIASES: Record<string, string[]> = {
  "ep-oral-iron": ["ferrous sulphate", "ferrous sulfate", "iron supplement", "iron tablets", "oral iron"],
};

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
