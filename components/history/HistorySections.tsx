/**
 * History sections — Iron / Ferritin (chart + measurements, treatment, follow-up) and Imaging
 * (examinations, follow-up) through one template. Every row opens its evidence; derived labels
 * open "How this was determined". Latest-update marks follow `latestUpdate.affected`.
 */
import type { HistoryView } from "@/lib/view/history";
import { formatDate } from "@/lib/text/dates";
import { CalculatedLabel, FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import MeasurementChart from "./MeasurementChart";
import styles from "./history.module.css";

const Updated = () => <span className={styles.updatedLabel}>Updated from latest record</span>;

function FollowUps({ rows }: { rows: HistoryView["followUps"] }) {
  if (rows.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="h-followup">
      <h2 id="h-followup" className={styles.sectionTitle}>
        Follow-up on record
      </h2>
      <ul className={`${styles.surface} ${styles.rows}`}>
        {rows.map((r) => (
          <li key={r.fact.id} className={r.updated ? `${styles.row} ${styles.updated}` : styles.row}>
            <div className={styles.rowMain}>
              <FactValue factId={r.fact.id} className={styles.rowTitle}>
                {r.fact.recommendation}
              </FactValue>
              <p className={styles.rowMeta}>Recommended {formatDate(r.fact.recommendedOn)}</p>
              {r.stateKey && (
                <div className={styles.rowClaims}>
                  <CalculatedLabel claimKey={r.stateKey} />
                  {r.elapsedMonths !== null && (
                    <span className={styles.chronology}>
                      dated {r.elapsedMonths} month{r.elapsedMonths === 1 ? "" : "s"} after the recommendation
                    </span>
                  )}
                </div>
              )}
              {r.updated && <Updated />}
            </div>
            <SourceRef factId={r.fact.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IronHistory({ view }: { view: Extract<HistoryView, { topic: "iron" }> }) {
  const latestUpdated = view.measurements.find((m) => m.updated)?.fact.id ?? null;
  return (
    <>
      <section className={styles.section} aria-labelledby="h-measurements">
        <h2 id="h-measurements" className={styles.sectionTitle}>
          Ferritin results <span className={styles.titleUnit}>· {view.series[0]?.unit ?? ""}</span>
        </h2>
        <div className={`${styles.surface} ${styles.chartSurface}`}>
          <MeasurementChart series={view.series} latestUpdatedId={latestUpdated} />
        </div>
        <ul className={`${styles.surface} ${styles.rows}`} aria-label="Ferritin results, newest first">
          {view.measurements.map((r) => (
            <li key={r.fact.id} className={r.updated ? `${styles.row} ${styles.updated}` : styles.row}>
              <p className={styles.rowDate}>{formatDate(r.fact.measuredOn)}</p>
              <div className={styles.rowMain}>
                <FactValue factId={r.fact.id} className={styles.rowValue}>
                  {r.fact.value} <span className={styles.unit}>{r.fact.unit}</span>
                </FactValue>
                {r.fact.refText && (
                  <p className={styles.rowMeta}>
                    Supplied range {r.fact.refText} {r.fact.unit}
                  </p>
                )}
                {r.claimKeys.length > 0 && (
                  <div className={styles.rowClaims}>
                    {r.claimKeys.map((k) => (
                      <CalculatedLabel key={k} claimKey={k} />
                    ))}
                  </div>
                )}
                {r.updated && <Updated />}
              </div>
              <SourceRef factId={r.fact.id} />
            </li>
          ))}
        </ul>
      </section>

      {view.treatment.map((t) => (
        <section key={t.name} className={styles.section} aria-labelledby="h-treatment">
          <h2 id="h-treatment" className={styles.sectionTitle}>
            Treatment · {t.name}
          </h2>
          <p className={styles.sectionNote}>Only statuses a document explicitly states. Dates are when each status was documented.</p>
          <ol className={`${styles.surface} ${styles.timeline}`}>
            {t.events.map((e) => (
              <li key={e.fact.id} className={e.updated ? `${styles.step} ${styles.updated}` : styles.step}>
                <span className={styles.stepDot} aria-hidden="true" />
                <div className={styles.rowMain}>
                  <FactValue factId={e.fact.id} className={styles.rowTitle}>
                    {e.fact.status}
                  </FactValue>
                  {/* documentedOn = date of the document stating the status, never an effective date */}
                  <p className={styles.rowMeta}>documented {formatDate(e.fact.documentedOn)}</p>
                  {e.updated && <Updated />}
                </div>
                <SourceRef factId={e.fact.id} />
              </li>
            ))}
          </ol>
        </section>
      ))}

      <FollowUps rows={view.followUps} />
    </>
  );
}

export function ImagingHistory({ view }: { view: Extract<HistoryView, { topic: "imaging" }> }) {
  return (
    <>
      <section className={styles.section} aria-labelledby="h-exams">
        <h2 id="h-exams" className={styles.sectionTitle}>
          Examinations
        </h2>
        <ol className={`${styles.surface} ${styles.timeline}`}>
          {view.exams.map((r) => (
            <li key={r.fact.id} className={r.updated ? `${styles.step} ${styles.updated}` : styles.step}>
              <span className={styles.stepDot} aria-hidden="true" />
              <div className={styles.rowMain}>
                <FactValue factId={r.fact.id} className={styles.rowTitle}>
                  {formatDate(r.fact.performedOn)} · {r.fact.examName}
                </FactValue>
                <p className={styles.statement}>{r.fact.statement}</p>
                {r.comparesToDate && <p className={styles.rowMeta}>Compared with the examination of {formatDate(r.comparesToDate)}, as stated in the report</p>}
                {r.updated && <Updated />}
              </div>
              <SourceRef factId={r.fact.id} />
            </li>
          ))}
        </ol>
      </section>
      <FollowUps rows={view.followUps} />
    </>
  );
}
