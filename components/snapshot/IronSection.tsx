/** Snapshot › Iron / Ferritin — only the most useful current facts, documentary wording. */
import Link from "next/link";
import type { FollowUp, LabMeasurement, MedicationStatusEvent } from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { CalculatedLabel, FactValue, SourceMarker } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

export default function IronSection({ view, index }: { view: SnapshotView["iron"]; index: EvidenceIndex }) {
  const latest = view.latestId ? (index.facts[view.latestId] as LabMeasurement) : null;
  const previous = view.previousId ? (index.facts[view.previousId] as LabMeasurement) : null;
  const med = view.medicationEventId ? (index.facts[view.medicationEventId] as MedicationStatusEvent) : null;
  const fu = view.followUpId ? (index.facts[view.followUpId] as FollowUp) : null;
  const episodeName = med ? index.episodes[med.episodeId] : null;

  return (
    <section className={styles.section} aria-labelledby="iron-heading">
      <div className={styles.sectionHead}>
        <h2 id="iron-heading" className={styles.sectionTitle}>
          Iron / Ferritin
        </h2>
        <Link href="/history/iron" className={styles.sectionLink}>
          Open history →
        </Link>
      </div>

      <dl className={styles.rows}>
        {latest && (
          <div className={styles.row}>
            <dt>Latest ferritin</dt>
            <dd>
              <div className={styles.line}>
                <FactValue factId={latest.id}>
                  <span className={styles.value}>
                    {latest.value} {latest.unit}
                  </span>
                </FactValue>
                <span className={styles.meta}>{formatDate(latest.measuredOn)}</span>
                <SourceMarker factId={latest.id} />
              </div>
              {latest.refText && (
                <p className={styles.meta}>
                  Supplied range {latest.refText} {latest.unit}
                </p>
              )}
              {view.latestClaimKeys.length > 0 && (
                <div className={styles.claims}>
                  {view.latestClaimKeys.map((k) => (
                    <CalculatedLabel key={k} claimKey={k} />
                  ))}
                </div>
              )}
            </dd>
          </div>
        )}

        {previous && (
          <div className={styles.row}>
            <dt>Previous</dt>
            <dd>
              <div className={styles.line}>
                <FactValue factId={previous.id}>
                  {previous.value} {previous.unit}
                </FactValue>
                <span className={styles.meta}>
                  {formatDate(previous.measuredOn)}
                  {previous.refText ? ` · supplied range ${previous.refText} ${previous.unit}` : ""}
                </span>
                <SourceMarker factId={previous.id} />
              </div>
            </dd>
          </div>
        )}

        {med && (
          <div className={styles.row}>
            <dt>{episodeName}</dt>
            <dd>
              <div className={styles.line}>
                <FactValue factId={med.id}>{med.status}</FactValue>
                {/* documentedOn is the date of the document stating the status — never an effective date */}
                <span className={styles.meta}>documented {formatDate(med.documentedOn)}</span>
                <SourceMarker factId={med.id} />
              </div>
            </dd>
          </div>
        )}

        {fu && (
          <div className={styles.row}>
            <dt>Documented follow-up</dt>
            <dd>
              <div className={styles.line}>
                <FactValue factId={fu.id}>{fu.recommendation}</FactValue>
                <span className={styles.meta}>recommended {formatDate(fu.recommendedOn)}</span>
                <SourceMarker factId={fu.id} />
              </div>
              {view.followUpMatchKey && (
                <div className={styles.claims}>
                  <CalculatedLabel claimKey={view.followUpMatchKey} />
                </div>
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
