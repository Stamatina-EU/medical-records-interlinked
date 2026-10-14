/**
 * History sections — Iron / Ferritin (chart + measurements, treatment, follow-up) and Imaging
 * (examinations, follow-up) through one template. Every row opens its evidence; derived labels
 * open "How this was determined". Latest-update marks follow `latestUpdate.affected`.
 */
import type { SourceFact } from "@/lib/model/types";
import type { HistoryView } from "@/lib/view/history";
import { formatDate } from "@/lib/text/dates";
import {
  CalculatedLabel,
  FactValue,
  SourceRef,
} from "@/components/ui/EvidenceLinks";
import MeasurementChart from "./MeasurementChart";
import styles from "./history.module.css";
import { statusLabel } from "@/lib/text/status";
import VisualIcon from "@/components/ui/VisualIcon";

const Updated = () => (
  <span className={styles.updatedLabel}>Updated from latest record</span>
);

export function IronHistory({
  view,
}: {
  view: Extract<HistoryView, { topic: "iron" }>;
}) {
  const latestUpdated =
    view.measurements.find((m) => m.updated)?.fact.id ?? null;
  return (
    <>
      <section className={styles.section} aria-labelledby="h-measurements">
        <h2 id="h-measurements" className={styles.sectionTitle}>
          <VisualIcon name="chart-no-axes-combined" size={26} /> Ferritin
          results{" "}
          <span className={styles.titleUnit}>
            · {view.series[0]?.unit ?? ""}
          </span>
        </h2>
        <div className={`${styles.surface} ${styles.chartSurface}`}>
          <MeasurementChart
            series={view.series}
            latestUpdatedId={latestUpdated}
          />
        </div>
      </section>
      <RecordSequence view={view} />
    </>
  );
}

function RecordSequence({
  view,
}: {
  view: Extract<HistoryView, { topic: "iron" }>;
}) {
  const events: {
    fact: SourceFact;
    date: string;
    title: string;
    detail: string | null;
    claims: string[];
    updated: boolean;
  }[] = [
    ...view.measurements.map((r) => ({
      fact: r.fact,
      date: r.fact.measuredOn,
      title: "Ferritin · " + r.fact.value + " " + r.fact.unit,
      detail: r.fact.refText
        ? "Supplied range " + r.fact.refText + " " + r.fact.unit
        : null,
      claims: r.claimKeys,
      updated: r.updated,
    })),
    ...view.treatment.flatMap((t) =>
      t.events.map((r) => ({
        fact: r.fact,
        date: r.fact.documentedOn,
        title: t.name + " · " + statusLabel(r.fact.status),
        detail: "Status documented on this date",
        claims: [],
        updated: r.updated,
      })),
    ),
    ...view.followUps.map((r) => ({
      fact: r.fact,
      date: r.fact.recommendedOn,
      title: r.fact.recommendation,
      detail: "Documented recommendation",
      claims: r.stateKey ? [r.stateKey] : [],
      updated: r.updated,
    })),
  ];
  events.sort(
    (a, b) =>
      b.date.localeCompare(a.date) || a.fact.id.localeCompare(b.fact.id),
  );
  return (
    <section className={styles.section} aria-labelledby="h-sequence">
      <h2 id="h-sequence" className={styles.sectionTitle}>
        <VisualIcon name="notebook-tabs" size={25} /> The dated record
      </h2>
      <p className={styles.sequenceNote}>
        Measurements, medication statements and recommendations · newest first
      </p>
      <ol className={styles.sequence}>
        {events.map((e) => (
          <li
            key={e.fact.id}
            data-fact-kind={e.fact.kind}
            className={e.updated ? styles.updated : undefined}
          >
            <div className={styles.sequenceDate}>
              <VisualIcon
                name={
                  e.fact.kind === "lab_measurement"
                    ? "flask-conical"
                    : e.fact.kind === "medication_status"
                      ? "pill"
                      : "clipboard-list"
                }
                size={21}
                className={styles.eventIcon}
              />
              <time dateTime={e.date}>{formatDate(e.date)}</time>
              <span>
                {e.fact.kind === "lab_measurement"
                  ? "Measurement"
                  : e.fact.kind === "medication_status"
                    ? "Medication statement"
                    : "Recommendation"}
              </span>
            </div>
            <div className={styles.sequenceBody}>
              <FactValue factId={e.fact.id} className={styles.rowTitle}>
                {e.title}
              </FactValue>
              {e.detail && <p className={styles.rowMeta}>{e.detail}</p>}
              <SourceRef factId={e.fact.id} />
              {e.claims.length > 0 && (
                <details className={styles.comparisons}>
                  <summary>Calculated from your record</summary>
                  <div className={styles.rowClaims}>
                    {e.claims.map((k) => (
                      <CalculatedLabel key={k} claimKey={k} />
                    ))}
                  </div>
                </details>
              )}
              {e.updated && <Updated />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ImagingHistory({
  view,
}: {
  view: Extract<HistoryView, { topic: "imaging" }>;
}) {
  const events = [
    ...view.exams.map((r) => ({
      fact: r.fact,
      date: r.fact.performedOn,
      title: r.fact.examName,
      detail: r.fact.statement,
      comparison: r.comparesToDate
        ? "Compared with the examination of " +
          formatDate(r.comparesToDate) +
          ", as stated in the report"
        : null,
      claims: [] as string[],
      updated: r.updated,
    })),
    ...view.followUps.map((r) => ({
      fact: r.fact,
      date: r.fact.recommendedOn,
      title: r.fact.recommendation,
      detail: "Documented recommendation",
      comparison: null,
      claims: r.stateKey ? [r.stateKey] : [],
      updated: r.updated,
    })),
  ].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || a.fact.id.localeCompare(b.fact.id),
  );
  return (
    <section className={styles.section} aria-labelledby="h-exams">
      <h2 id="h-exams" className={styles.sectionTitle}>
        <VisualIcon name="notebook-tabs" size={25} /> The dated record
      </h2>
      <p className={styles.sequenceNote}>
        Examinations and recommendations · newest first
      </p>
      <ol className={styles.sequence}>
        {events.map((e) => (
          <li
            key={e.fact.id}
            data-fact-kind={e.fact.kind}
            className={e.updated ? styles.updated : undefined}
          >
            <div className={styles.sequenceDate}>
              <VisualIcon
                name={
                  e.fact.kind === "imaging_exam"
                    ? "scan-line"
                    : "clipboard-list"
                }
                size={21}
                className={styles.eventIcon}
              />
              <time dateTime={e.date}>{formatDate(e.date)}</time>
              <span>
                {e.fact.kind === "imaging_exam"
                  ? "Examination"
                  : "Recommendation"}
              </span>
            </div>
            <div className={styles.sequenceBody}>
              <FactValue factId={e.fact.id} className={styles.rowTitle}>
                {e.title}
              </FactValue>
              <p
                className={
                  e.fact.kind === "imaging_exam"
                    ? styles.statement
                    : styles.rowMeta
                }
              >
                {e.detail}
              </p>
              {e.comparison && <p className={styles.rowMeta}>{e.comparison}</p>}
              <SourceRef factId={e.fact.id} />
              {e.claims.length > 0 && (
                <details className={styles.comparisons}>
                  <summary>Calculated from your record</summary>
                  <div className={styles.rowClaims}>
                    {e.claims.map((k) => (
                      <CalculatedLabel key={k} claimKey={k} />
                    ))}
                  </div>
                </details>
              )}
              {e.updated && <Updated />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
