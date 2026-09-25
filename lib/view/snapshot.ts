/**
 * Snapshot view model — which facts and calculated claims the Snapshot shows. Pure.
 * Spec: `spec.md > Snapshot Page`; PRD: `prd.md > Snapshot`.
 * Nothing here asserts absence: a line appears only when a fact or claim supports it.
 */
import type { CalculatedClaim, ImagingExam, TrustedState } from "@/lib/model/types";
import { ferritinSeries, followUps, latestMedicationStatus } from "@/lib/engine/derive";

export type SnapshotView = {
  patientName: string;
  lastUpdated: string; // ISO date-time
  iron: {
    latestId: string | null;
    latestClaimKeys: string[];
    previousId: string | null;
    medicationEventId: string | null;
    followUpId: string | null;
    followUpMatchKey: string | null;
  };
  imaging: {
    followUpId: string | null; // follow-up documented after the earlier examination
    lastRelatedExamId: string | null; // latest exam that EXPLICITLY references an earlier one
  };
};

export function snapshotView(state: TrustedState, claims: CalculatedClaim[]): SnapshotView {
  const has = (key: string) => claims.some((c) => c.key === key);
  const series = ferritinSeries(state);
  const latest = series[series.length - 1] ?? null;
  const previous = series[series.length - 2] ?? null;

  const latestClaimKeys = latest
    ? [`range:${latest.id}`, `change:${latest.id}`, `prev-outside:${latest.id}`].filter(has)
    : [];

  const ironFollowUps = followUps(state, "iron");
  const fu = ironFollowUps[ironFollowUps.length - 1] ?? null;
  const matchKey = fu && has(`followup-match:${fu.id}`) ? `followup-match:${fu.id}` : null;

  const med = state.episodes[0] ? latestMedicationStatus(state, state.episodes[0].id) : null;

  const exams = state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  const related = [...exams].reverse().find((e) => e.comparesToDocumentId !== null) ?? null;
  const imagingFollowUp = related
    ? followUps(state, "imaging").find((f) => f.source.documentId === related.comparesToDocumentId) ?? null
    : null;

  return {
    patientName: state.patient.displayName,
    lastUpdated: state.latestUpdate?.approvedAt ?? state.seededAt,
    iron: {
      latestId: latest?.id ?? null,
      latestClaimKeys,
      previousId: previous?.id ?? null,
      medicationEventId: med?.id ?? null,
      followUpId: fu?.id ?? null,
      followUpMatchKey: matchKey,
    },
    imaging: {
      followUpId: imagingFollowUp?.id ?? null,
      lastRelatedExamId: related?.id ?? null,
    },
  };
}
