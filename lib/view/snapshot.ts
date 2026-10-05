/**
 * Home view model — summary-first, patient-centred, and built to scale from 5 records to 500.
 * Pure. Spec: `spec.md > Snapshot Page`; PRD: `prd.md > Snapshot`.
 *
 * Home answers "what does my documented record contain right now?" with deterministic counts
 * and the latest item per category. Details live behind interaction (evidence) or in History.
 * Nothing here interprets health, and nothing asserts absence.
 */
import type { CalculatedClaim, ChangeLine, DocumentRecord, ImagingExam, TrustedState } from "@/lib/model/types";
import { ferritinSeries, followUps, latestMedicationStatus } from "@/lib/engine/derive";
import { changesSummary } from "@/lib/engine/changes";
import { FERRITIN_SERIES_KEY, IMAGING_KEY, TREATMENTS_KEY } from "@/lib/engine/recordClaims";

/** stateKey: the derived chronology claim for this follow-up (match found, or no later result), if any */
export type FollowUpItem = { factId: string; stateKey: string | null; updated: boolean };

export type HistoryTopicSummary = {
  topic: "iron" | "imaging";
  title: string;
  /** factual counts and date span only — no interpretation */
  count: number;
  countNoun: string;
  firstDate: string | null;
  lastDate: string | null;
  extra: string | null;
};

/** countClaimKey: the derived record claim behind the row's count and "latest" selection (lib/engine/recordClaims.ts) */
export type LatestGroup =
  | { kind: "measurements"; count: number; countLabel: string; countClaimKey: string; latestFactId: string; claimKeys: string[]; href: string; updated: boolean }
  | { kind: "treatment"; count: number; countLabel: string; countClaimKey: string; latestEventId: string; href: string; updated: boolean }
  | { kind: "imaging"; count: number; countLabel: string; countClaimKey: string; latestExamId: string; href: string; updated: boolean };

export type SnapshotView = {
  patientName: string;
  lastUpdated: string; // ISO date-time
  /** only after an approved update: the document it came from, and what it changed */
  latestUpdate: { document: DocumentRecord; changes: ChangeLine[] } | null;
  summary: {
    documentCount: number;
    /** evidence coverage: how many documents of each kind back this record */
    documentTypes: { label: string; count: number }[];
    firstDocumentDate: string | null;
    lastDocumentDate: string | null;
  };
  latestGroups: LatestGroup[];
  followUpsOnRecord: FollowUpItem[];
  history: HistoryTopicSummary[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function snapshotView(state: TrustedState, claims: CalculatedClaim[]): SnapshotView {
  const has = (key: string) => claims.some((c) => c.key === key);
  const affected = new Set(state.latestUpdate?.affected ?? []);

  const series = ferritinSeries(state);
  const exams = state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  const treatments = state.episodes
    .map((ep) => ({ ep, latest: latestMedicationStatus(state, ep.id) }))
    .filter((t) => t.latest !== null)
    .sort((a, b) => a.latest!.documentedOn.localeCompare(b.latest!.documentedOn));

  // Follow-up on record: the most recent documented recommendation per topic
  const followUpsOnRecord: FollowUpItem[] = [];
  for (const topic of ["iron", "imaging"] as const) {
    const list = followUps(state, topic);
    const fu = list[list.length - 1];
    if (!fu) continue;
    const stateKey = [`followup-match:${fu.id}`, `followup-no-later:${fu.id}`].find(has) ?? null;
    followUpsOnRecord.push({ factId: fu.id, stateKey, updated: stateKey !== null && affected.has(stateKey) });
  }

  // Latest in your record — one compact group per category, never one card per value
  const latestGroups: LatestGroup[] = [];
  if (series.length > 0) {
    const latest = series[series.length - 1];
    latestGroups.push({
      kind: "measurements",
      count: series.length,
      countLabel: plural(series.length, "ferritin result", "ferritin results"),
      countClaimKey: FERRITIN_SERIES_KEY,
      latestFactId: latest.id,
      claimKeys: [`range:${latest.id}`].filter(has),
      href: "/history/iron",
      updated: affected.has(latest.id),
    });
  }
  if (treatments.length > 0) {
    const latest = treatments[treatments.length - 1];
    latestGroups.push({
      kind: "treatment",
      count: treatments.length,
      countLabel: plural(treatments.length, "treatment documented", "treatments documented"),
      countClaimKey: TREATMENTS_KEY,
      latestEventId: latest.latest!.id,
      href: `/history/${latest.ep.topic}`,
      updated: affected.has(latest.latest!.id),
    });
  }
  if (exams.length > 0) {
    const noun = exams[0].examName.toLowerCase();
    latestGroups.push({
      kind: "imaging",
      count: exams.length,
      countLabel: plural(exams.length, noun, `${noun}s`),
      countClaimKey: IMAGING_KEY,
      latestExamId: exams[exams.length - 1].id,
      href: "/history/imaging",
      updated: affected.has(exams[exams.length - 1].id),
    });
  }

  const history: HistoryTopicSummary[] = [];
  if (series.length > 0) {
    const med = treatments.find((t) => t.ep.topic === "iron");
    history.push({
      topic: "iron",
      title: "Iron / Ferritin",
      count: series.length,
      countNoun: series.length === 1 ? "ferritin result" : "ferritin results",
      firstDate: series[0].measuredOn,
      lastDate: series[series.length - 1].measuredOn,
      extra: med ? med.ep.name.split(" (")[0] : null,
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
    });
  }

  const docDates = state.documents.map((d) => d.date).sort();
  const TYPE_LABELS: Record<string, [string, string]> = {
    lab_report: ["lab report", "lab reports"],
    imaging_report: ["imaging report", "imaging reports"],
    consultation_note: ["consultation note", "consultation notes"],
    prescription: ["prescription", "prescriptions"],
    other: ["other document", "other documents"],
  };
  const typeCounts = new Map<string, number>();
  for (const d of state.documents) typeCounts.set(d.documentType, (typeCounts.get(d.documentType) ?? 0) + 1);
  const documentTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => ({ label: (TYPE_LABELS[type] ?? [type, type])[count === 1 ? 0 : 1], count }));

  return {
    patientName: state.patient.displayName,
    lastUpdated: state.latestUpdate?.approvedAt ?? state.seededAt,
    latestUpdate: (() => {
      const doc = state.latestUpdate ? state.documents.find((d) => d.id === state.latestUpdate!.documentId) : undefined;
      return doc ? { document: doc, changes: changesSummary(state) } : null;
    })(),
    summary: {
      documentCount: state.documents.length,
      documentTypes,
      firstDocumentDate: docDates[0] ?? null,
      lastDocumentDate: docDates[docDates.length - 1] ?? null,
    },
    latestGroups,
    followUpsOnRecord,
    history,
  };
}
