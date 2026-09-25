/**
 * History view model — one longitudinal topic across time. Pure.
 * Spec: `spec.md > History Page (Topic Template)`; PRD: `prd.md > History (topic template)`.
 *
 * Iron / Ferritin: measurements (each with the range supplied WITH that result), the medication
 * episode's explicit status events, and the documented follow-up with its derived chronology.
 * Imaging: the same template without a chart — examinations and documented follow-ups.
 * Read-only presentation of approved facts and derived claims; no new medical logic.
 */
import type {
  CalculatedClaim,
  FollowUp,
  ImagingExam,
  LabMeasurement,
  MedicationStatusEvent,
  TrustedState,
} from "@/lib/model/types";
import { ferritinSeries, followUps, medicationEvents } from "@/lib/engine/derive";
import { monthsBetween } from "@/lib/text/dates";

export type Topic = "iron" | "imaging";
export const TOPICS: { topic: Topic; title: string }[] = [
  { topic: "iron", title: "Iron / Ferritin" },
  { topic: "imaging", title: "Imaging follow-up" },
];

export type MeasurementRow = { fact: LabMeasurement; claimKeys: string[]; updated: boolean };
export type FollowUpRow = {
  fact: FollowUp;
  stateKey: string | null;
  /** plain chronology when a later matching result exists — never a timing judgement */
  elapsedMonths: number | null;
  updated: boolean;
};
export type EventRow = { fact: MedicationStatusEvent; updated: boolean };
export type ExamRow = { fact: ImagingExam; comparesToDate: string | null; updated: boolean };

export type HistoryView =
  | {
      topic: "iron";
      title: string;
      firstDate: string | null;
      lastDate: string | null;
      measurements: MeasurementRow[]; // newest first
      series: LabMeasurement[]; // oldest first, for the chart
      treatment: { name: string; events: EventRow[] }[];
      followUps: FollowUpRow[];
    }
  | {
      topic: "imaging";
      title: string;
      firstDate: string | null;
      lastDate: string | null;
      exams: ExamRow[]; // chronological (oldest first), like the treatment timeline
      followUps: FollowUpRow[];
    };

export function historyView(state: TrustedState, claims: CalculatedClaim[], topic: Topic): HistoryView {
  const has = (key: string) => claims.some((c) => c.key === key);
  const affected = new Set(state.latestUpdate?.affected ?? []);
  const title = TOPICS.find((t) => t.topic === topic)!.title;

  const followUpRows = (list: FollowUp[]): FollowUpRow[] =>
    [...list].reverse().map((fu) => {
      const matchKey = `followup-match:${fu.id}`;
      const stateKey = [matchKey, `followup-no-later:${fu.id}`].find(has) ?? null;
      const match = stateKey === matchKey ? claims.find((c) => c.key === matchKey) : undefined;
      const result = match ? (state.facts.find((f) => f.id === match.inputFactIds[1]) as LabMeasurement | undefined) : undefined;
      return {
        fact: fu,
        stateKey,
        elapsedMonths: result ? monthsBetween(fu.recommendedOn, result.measuredOn) : null,
        updated: affected.has(fu.id) || (stateKey !== null && affected.has(stateKey)),
      };
    });

  if (topic === "iron") {
    const series = ferritinSeries(state);
    return {
      topic,
      title,
      firstDate: series[0]?.measuredOn ?? null,
      lastDate: series[series.length - 1]?.measuredOn ?? null,
      series,
      measurements: [...series].reverse().map((m) => ({
        fact: m,
        claimKeys: [`range:${m.id}`, `change:${m.id}`, `prev-outside:${m.id}`].filter(has),
        updated: affected.has(m.id),
      })),
      treatment: state.episodes
        .filter((ep) => ep.topic === "iron")
        .map((ep) => ({
          name: ep.name,
          events: medicationEvents(state, ep.id).map((e) => ({ fact: e, updated: affected.has(e.id) })),
        }))
        .filter((t) => t.events.length > 0),
      followUps: followUpRows(followUps(state, "iron")),
    };
  }

  const exams = state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  const docDate = (id: string | null) => (id ? (state.documents.find((d) => d.id === id)?.date ?? null) : null);
  return {
    topic,
    title,
    firstDate: exams[0]?.performedOn ?? null,
    lastDate: exams[exams.length - 1]?.performedOn ?? null,
    exams: exams.map((x) => ({
      fact: x,
      // only when the later report EXPLICITLY references the earlier examination (verified in the seed)
      comparesToDate: docDate(x.comparesToDocumentId),
      updated: affected.has(x.id),
    })),
    followUps: followUpRows(followUps(state, "imaging")),
  };
}
