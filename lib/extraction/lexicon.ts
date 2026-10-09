/**
 * The shared lexicon: the supported subjects and their names in SOURCE TEXT. The supported sentence and line
 * structures built from them live in `grammar.ts`. Used by the live Fact Verifier and the Seed Verifier alike
 * (`spec.md > Fact Verifier`).
 * All patterns are matched against normalized (lowercased) text.
 */
import type { MedicationEpisode } from "@/lib/model/types";

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

export const FOLLOW_UP_CUES: RegExp[] = [/\brepeat\b/, /\brecheck\b/, /\bfollow-up\b/, /\brecommended\b/];

export const EXAM_ALIASES: Record<string, string[]> = {
  "Thyroid ultrasound": ["thyroid ultrasound", "ultrasound"],
};

export const COMPARISON_CUES: RegExp[] = [/\bcomparison\b/, /\bcompared with\b/];

/** Units recognised in a laboratory table row (normalized, lowercase). */
export const UNITS: string[] = ["μg/l", "ng/ml", "g/dl", "g/l", "mmol/l", "μmol/l", "x10^9/l", "%"];

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word/phrase containment on normalized text. */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}($|[^a-z0-9])`).test(normalizedText);
}
