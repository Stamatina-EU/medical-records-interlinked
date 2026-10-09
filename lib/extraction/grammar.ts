/**
 * The SUPPORTED SOURCE STRUCTURES — a deliberately tiny, code-owned positive grammar. Spec: `spec.md > Fact Verifier`.
 *
 * A fact is Verified only when its COMPLETE authoritative source unit (a whole sentence, a whole result line, a whole
 * header line) matches one of these structures, and that structure directly establishes exactly that fact. Anything
 * else fails closed. There is no list of "bad" words to keep growing — only this short list of supported shapes,
 * taken from the committed synthetic corpus and live demo note. False negatives are accepted; semantic false
 * positives are not. Every pattern matches a whole NORMALIZED unit (lowercased, whitespace collapsed).
 */
import type { MedicationStatus } from "@/lib/model/types";
import { ANALYTE_ALIASES, MEDICATION_ALIASES, UNITS, escapeRegExp } from "@/lib/extraction/lexicon";
import { isIsoDate } from "@/lib/text/dates";

const NUM = String.raw`\d+(?:\.\d+)?`;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const alternatives = (words: string[]) => [...words].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");

/** The one supported date form, as written throughout the corpus: "25 sep 2026". */
const DATE = String.raw`(?<day>\d{1,2}) (?<month>${MONTHS.join("|")}) (?<year>\d{4})`;

/** ISO form of a DATE match, or null for an impossible date ("31 feb 2026"). */
export function isoFromDate(groups: Record<string, string | undefined> | undefined): string | null {
  if (!groups?.day || !groups.month || !groups.year) return null;
  const iso = `${groups.year}-${String(MONTHS.indexOf(groups.month) + 1).padStart(2, "0")}-${groups.day.padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

// ─── Document date: one complete page-1 header line ───────────────────────────────────────
/** The labels that may introduce THE document's own date (the four common forms plus the two the seed uses). */
export const DOCUMENT_DATE_LABELS = ["date", "date of consultation", "consultation date", "report date", "date issued", "examination date"];
const LABEL = `(?:${alternatives(DOCUMENT_DATE_LABELS)})`;
/** "Date of consultation 25 Sep 2026", "Report date: 14 Mar 2025": the label, an optional colon, one date — and nothing else. */
export const HEADER_DATE_LINE = new RegExp(`^${LABEL} ?:? ?${DATE}$`);
/** A header line that sets out to give a document date (the label, then a colon, a digit or a bracket). It must then be a complete HEADER_DATE_LINE. */
export const HEADER_DATE_INTRO = new RegExp(`^${LABEL} ?[:\\d(]`);

// ─── Oral iron status: one complete sentence ──────────────────────────────────────────────
/**
 * The supported sentences for each status, with the medication as the direct object or subject of the status verb
 * and, where there is a person, the patient as the subject:
 *  - Prescribed: "Prescribed: ferrous sulfate 200 mg tablets, one tablet once daily for 3 months." · "Oral iron was prescribed."
 *  - Current:    "The patient continues to take oral iron (ferrous sulfate) once daily." · "The patient is currently taking oral iron."
 *  - Completed:  "The patient completed oral iron." · "Oral iron was completed."
 *  - Stopped:    "The patient stopped oral iron." · "Oral iron (ferrous sulfate) was stopped." · "… was discontinued."
 */
export function medicationStatusGrammar(episodeId: string): Record<MedicationStatus, RegExp[]> {
  const name = `(?:${alternatives(MEDICATION_ALIASES[episodeId] ?? [])})`;
  const dose = String.raw`\d+(?:\.\d+)? mg(?: tablets?)?`;
  const med = String.raw`${name}(?: ${dose})?(?: \(${name}(?: ${dose})?\))?`;
  const regimen = String.raw`(?:,? (?:one tablet )?once daily(?: for \d+ months?)?)?`;
  const whole = (body: string) => new RegExp(`^${body}\\.$`);
  return {
    Prescribed: [whole(`prescribed ?: ${med}${regimen}`), whole(`${med} was prescribed${regimen}`)],
    Current: [whole(`the patient (?:continues to take|is currently taking) ${med}${regimen}`)],
    Completed: [whole(`the patient completed ${med}`), whole(`${med} was completed`)],
    Stopped: [whole(`the patient stopped ${med}`), whole(`${med} was (?:stopped|discontinued)`)],
  };
}

// ─── Ferritin: one complete physical result line ──────────────────────────────────────────
const FERRITIN = `(?:${alternatives(ANALYTE_ALIASES.ferritin)})`;
const FERRITIN_UNIT = `(?:μg/l|ng/ml)`;
/**
 * A result written as its own sentence on its own line:
 * "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." — the date and the range are optional.
 */
export const FERRITIN_SENTENCE = new RegExp(
  `^${FERRITIN}(?: on ${DATE})?(?: ?: ?| )(?<value>${NUM}) (?<unit>${FERRITIN_UNIT})` +
    `(?: \\(reference range (?<low>${NUM}) ?- ?(?<high>${NUM})(?: (?<rangeUnit>${FERRITIN_UNIT}))?\\))?\\.$`,
);
/** A result written as a laboratory table row: "Ferritin 19.6 μg/L 15–150" (test, result, units, reference range). */
export const FERRITIN_ROW = new RegExp(`^${FERRITIN} (?<value>${NUM}) (?<unit>${FERRITIN_UNIT}) (?<low>${NUM}) ?- ?(?<high>${NUM})$`);
/** The laboratory table: its column header, any well-formed row, and the closing note that may follow the rows. */
export const TABLE_HEADER = "test result units reference range";
export const TABLE_ROW = new RegExp(`^[a-z][a-z ]*[a-z] ${NUM} (?:${alternatives(UNITS)}) ${NUM} ?- ?${NUM}$`);
export const TABLE_NOTE = /^reference ranges are supplied by [^.]+\.$/;

// ─── Sections ─────────────────────────────────────────────────────────────────────────────
/** The section a fact must sit in (its nearest heading; the table's column header does not count as a section). */
export const FACT_SECTIONS: Record<"medication" | "ferritin", string[]> = {
  medication: ["medication", "medication history"],
  ferritin: ["results", "iron studies", "haematology and iron studies"],
};
/** Every heading above a fact must be one of the corpus's ordinary sections; any other heading fails closed. */
export const KNOWN_SECTIONS: string[] = [...FACT_SECTIONS.medication, ...FACT_SECTIONS.ferritin, "reason for visit", "history", "full blood count", TABLE_HEADER];
