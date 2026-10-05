/**
 * Record claims — code-derived MEDICAL aggregation and latest-selection claims over approved
 * facts (counts, "latest"), shared by Home and the Doctor Summary. Pure; recomputed on every
 * render like `derive()`, never persisted.
 *
 * Direct = a source states it. Derived = code determines it from approved facts. A count or a
 * "latest" selection is Derived even though every input is source-backed, so each claim lists
 * every input it was determined from. Record/navigation metadata (document counts, record date
 * spans) is not a medical claim and has no claim here.
 */
import type { CalculatedClaim, ImagingExam, TrustedState } from "@/lib/model/types";
import { ferritinSeries, latestMedicationStatus, medicationEvents } from "@/lib/engine/derive";
import { formatDate } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";

export const FERRITIN_SERIES_KEY = "record-series:ferritin";
export const TREATMENTS_KEY = "record-treatments";
export const IMAGING_KEY = "record-imaging";
export const latestExamKey = (examName: string) => `record-latest-exam:${examName}`;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function imagingExams(state: TrustedState): ImagingExam[] {
  return state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
}

/** Ferritin count + latest result (Home "Measurements" row; Doctor Summary picture and history line). */
export function ferritinSeriesClaim(state: TrustedState): CalculatedClaim | null {
  const series = ferritinSeries(state);
  const last = series[series.length - 1];
  if (!last) return null;
  return {
    key: FERRITIN_SERIES_KEY,
    kind: "series_count",
    text: `${series.length} ferritin ${series.length === 1 ? "measurement" : "measurements"} documented · latest ${last.value} ${last.unit} on ${formatDate(last.measuredOn)}`,
    ruleDescription:
      "Counted every approved ferritin result in your record and ordered them by measurement date; the latest is the one with the most recent date. No document states this count or which result is the latest.",
    inputFactIds: series.map((m) => m.id),
  };
}

/** The latest examination of one kind, when there are at least two (Doctor Summary picture). */
export function latestExamClaim(state: TrustedState, examName: string): CalculatedClaim | null {
  const ofName = imagingExams(state).filter((x) => x.examName === examName);
  if (ofName.length < 2) return null;
  const latest = ofName[ofName.length - 1];
  return {
    key: latestExamKey(examName),
    kind: "latest_exam",
    text: `Latest documented ${lowerFirst(examName)} · ${formatDate(latest.performedOn)}`,
    ruleDescription: `Ordered every approved ${lowerFirst(examName)} in your record by examination date and took the most recent. No document states which examination is the latest.`,
    inputFactIds: ofName.map((x) => x.id),
  };
}

/** Imaging count + latest examination (Home "Imaging" row). */
export function imagingClaim(state: TrustedState): CalculatedClaim | null {
  const exams = imagingExams(state);
  const latest = exams[exams.length - 1];
  if (!latest) return null;
  const noun = exams[0].examName.toLowerCase();
  return {
    key: IMAGING_KEY,
    kind: "series_count",
    text: `${exams.length} ${exams.length === 1 ? noun : `${noun}s`} documented · latest ${formatDate(latest.performedOn)}`,
    ruleDescription: `Counted every approved imaging examination in your record and ordered them by examination date; the latest is the one with the most recent date. No document states this count or which examination is the latest.`,
    inputFactIds: exams.map((x) => x.id),
  };
}

/** Treatment count + latest documented status (Home "Treatment / medication" row). */
export function treatmentsClaim(state: TrustedState): CalculatedClaim | null {
  const treatments = state.episodes
    .map((ep) => ({ ep, latest: latestMedicationStatus(state, ep.id) }))
    .filter((t) => t.latest !== null)
    .sort((a, b) => a.latest!.documentedOn.localeCompare(b.latest!.documentedOn));
  const last = treatments[treatments.length - 1];
  if (!last) return null;
  const n = treatments.length;
  return {
    key: TREATMENTS_KEY,
    kind: "latest_status",
    text: `${n} ${n === 1 ? "treatment" : "treatments"} documented · latest status: ${last.ep.name.split(" (")[0]} · ${statusLabel(last.latest!.status)}`,
    ruleDescription:
      "Counted every medication with an approved status in your record and ordered the status facts by documentation date; the latest is the one with the most recent date. No document states this count or which status is the latest.",
    inputFactIds: treatments.flatMap((t) => medicationEvents(state, t.ep.id).map((e) => e.id)),
  };
}

/** Every record claim, for the evidence drawer's index on pages that show them. */
export function recordClaims(state: TrustedState): CalculatedClaim[] {
  const examNames = [...new Set(imagingExams(state).map((x) => x.examName))];
  return [ferritinSeriesClaim(state), treatmentsClaim(state), imagingClaim(state), ...examNames.map((n) => latestExamClaim(state, n))].filter(
    (c): c is CalculatedClaim => c !== null,
  );
}
