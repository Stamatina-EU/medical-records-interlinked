/**
 * Snapshot view model — patient-centred, moment-centred. Pure.
 * Spec: `spec.md > Snapshot Page`; PRD: `prd.md > Snapshot`.
 *
 * The first screen answers: what the latest documented evidence shows, what follow-up is on record,
 * what changed recently, and where to go deeper. Medical topics (Iron / Ferritin, Imaging)
 * are one level down, under "Your history".
 * Nothing here asserts absence: an item appears only when a fact or claim supports it.
 */
import type { CalculatedClaim, ImagingExam, TrustedState } from "@/lib/model/types";
import { ferritinSeries, followUps, latestMedicationStatus } from "@/lib/engine/derive";

export type FollowUpItem = { factId: string; matchKey: string | null };

export type HistoryTopicSummary = {
  topic: "iron" | "imaging";
  title: string;
  /** factual counts and date span only — no interpretation */
  count: number;
  countNoun: string;
  firstDate: string | null;
  lastDate: string | null;
  extra: string | null;
  /** documented points for a small visual timeline: values (iron) or dates only (imaging) */
  points: { date: string; value: number | null }[];
};

export type SnapshotView = {
  patientName: string;
  lastUpdated: string; // ISO date-time
  documentCount: number;
  rightNow: {
    ferritinId: string | null;
    ferritinClaimKeys: string[];
    medicationEventId: string | null;
    relatedImagingId: string | null;
  };
  followUpsOnRecord: FollowUpItem[];
  history: HistoryTopicSummary[];
};

export function snapshotView(state: TrustedState, claims: CalculatedClaim[]): SnapshotView {
  const has = (key: string) => claims.some((c) => c.key === key);

  const series = ferritinSeries(state);
  const latest = series[series.length - 1] ?? null;
  // "Latest in your record" shows only the latest documented facts; longitudinal claims (previously outside,
  // changed since previous) live in History and, after an update, in "What changed".
  const ferritinClaimKeys = latest ? [`range:${latest.id}`].filter(has) : [];

  const episode = state.episodes[0] ?? null;
  const med = episode ? latestMedicationStatus(state, episode.id) : null;

  const exams = state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  // "Related" only when the report itself explicitly references an earlier examination
  const related = [...exams].reverse().find((e) => e.comparesToDocumentId !== null) ?? null;

  // Follow-up on record: the most recent documented recommendation per topic
  const followUpsOnRecord: FollowUpItem[] = [];
  for (const topic of ["iron", "imaging"] as const) {
    const list = followUps(state, topic);
    const fu = list[list.length - 1];
    if (!fu) continue;
    const key = `followup-match:${fu.id}`;
    followUpsOnRecord.push({ factId: fu.id, matchKey: has(key) ? key : null });
  }

  const history: HistoryTopicSummary[] = [];
  if (series.length > 0) {
    history.push({
      topic: "iron",
      title: "Iron / Ferritin",
      count: series.length,
      countNoun: series.length === 1 ? "ferritin result" : "ferritin results",
      firstDate: series[0].measuredOn,
      lastDate: series[series.length - 1].measuredOn,
      extra: episode && med ? episode.name.split(" (")[0] : null,
      points: series.map((m) => ({ date: m.measuredOn, value: m.value })),
    });
  }
  if (exams.length > 0) {
    history.push({
      topic: "imaging",
      title: "Imaging follow-up",
      count: exams.length,
      countNoun: exams.length === 1 ? exams[0].examName.toLowerCase() : `${exams[0].examName.toLowerCase()}s`,
      firstDate: exams[0].performedOn,
      lastDate: exams[exams.length - 1].performedOn,
      extra: null,
      points: exams.map((e) => ({ date: e.performedOn, value: null })),
    });
  }

  return {
    patientName: state.patient.displayName,
    lastUpdated: state.latestUpdate?.approvedAt ?? state.seededAt,
    documentCount: state.documents.length,
    rightNow: {
      ferritinId: latest?.id ?? null,
      ferritinClaimKeys,
      medicationEventId: med?.id ?? null,
      relatedImagingId: related?.id ?? null,
    },
    followUpsOnRecord,
    history,
  };
}
