/**
 * "Latest in your record" — the most recent DOCUMENTED value / status for each part of the picture.
 * Named for what the evidence supports: the latest record, not a claim about today.
 * Composition: ferritin is the primary documented datum; oral iron and imaging support it.
 */
import Link from "next/link";
import type { ImagingExam, LabMeasurement, MedicationStatusEvent } from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { CalculatedLabel, FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

export default function LatestInRecord({ view, index }: { view: SnapshotView["rightNow"]; index: EvidenceIndex }) {
  const ferritin = view.ferritinId ? (index.facts[view.ferritinId] as LabMeasurement) : null;
  const med = view.medicationEventId ? (index.facts[view.medicationEventId] as MedicationStatusEvent) : null;
  const imaging = view.relatedImagingId ? (index.facts[view.relatedImagingId] as ImagingExam) : null;
  if (!ferritin && !med && !imaging) return null;
  const medName = med ? (index.episodes[med.episodeId] ?? "Medication").split(" (")[0] : null;

  return (
    <section className={styles.module} aria-labelledby="latest-heading">
      <div className={styles.moduleHead}>
        <h2 id="latest-heading" className={styles.moduleTitle}>
          Latest in your record
        </h2>
        <p className={styles.moduleNote}>The most recent documented value or status</p>
      </div>

      <div className={styles.latestGrid}>
        {ferritin && (
          <article className={`${styles.surface} ${styles.primary}`}>
            <p className={styles.eyebrow}>Ferritin · latest result</p>
            <FactValue factId={ferritin.id} className={styles.displayValue}>
              {ferritin.value}
              <span className={styles.displayUnit}>{ferritin.unit}</span>
            </FactValue>
            <p className={styles.primaryMeta}>
              <span className={styles.keep}>Measured {formatDate(ferritin.measuredOn)}</span>
              {ferritin.refText && (
                <>
                  {" · "}
                  <span className={styles.keep}>
                    supplied range {ferritin.refText} {ferritin.unit}
                  </span>
                </>
              )}
            </p>
            {view.ferritinClaimKeys.length > 0 && (
              <div className={styles.claimRow}>
                {view.ferritinClaimKeys.map((k) => (
                  <CalculatedLabel key={k} claimKey={k} />
                ))}
              </div>
            )}
            <div className={styles.primaryFoot}>
              <SourceRef factId={ferritin.id} />
              <Link href="/history/iron" className={styles.inlineLink}>
                Ferritin history →
              </Link>
            </div>
          </article>
        )}

        {(med || imaging) && (
          <div className={`${styles.surface} ${styles.supporting}`}>
            {med && (
              <article className={styles.supportItem}>
                <p className={styles.eyebrow}>{medName}</p>
                <FactValue factId={med.id} className={styles.supportValue}>
                  {med.status}
                </FactValue>
                {/* documentedOn = date of the document stating the status, never an effective date */}
                <p className={styles.supportMeta}>documented {formatDate(med.documentedOn)}</p>
                <SourceRef factId={med.id} />
              </article>
            )}
            {imaging && (
              <article className={styles.supportItem}>
                <p className={styles.eyebrow}>Latest related imaging</p>
                <FactValue factId={imaging.id} className={styles.supportValue}>
                  {formatDate(imaging.performedOn)}
                </FactValue>
                <p className={styles.supportMeta}>{imaging.examName}</p>
                <SourceRef factId={imaging.id} />
              </article>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
