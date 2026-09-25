/** Snapshot › Imaging follow-up — a small secondary topic, non-numeric, no chart. */
import Link from "next/link";
import type { FollowUp, ImagingExam } from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { FactValue, SourceMarker } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

export default function ImagingSection({ view, index }: { view: SnapshotView["imaging"]; index: EvidenceIndex }) {
  const fu = view.followUpId ? (index.facts[view.followUpId] as FollowUp) : null;
  const exam = view.lastRelatedExamId ? (index.facts[view.lastRelatedExamId] as ImagingExam) : null;
  if (!fu && !exam) return null;

  return (
    <section className={`${styles.section} ${styles.secondary}`} aria-labelledby="imaging-heading">
      <div className={styles.sectionHead}>
        <h2 id="imaging-heading" className={styles.sectionTitle}>
          Imaging follow-up
        </h2>
        <Link href="/history/imaging" className={styles.sectionLink}>
          Open history →
        </Link>
      </div>
      <dl className={styles.rows}>
        {fu && (
          <div className={styles.row}>
            <dt>Documented follow-up</dt>
            <dd>
              <div className={styles.line}>
                <FactValue factId={fu.id}>Follow-up documented after previous imaging</FactValue>
                <span className={styles.meta}>{formatDate(fu.recommendedOn)}</span>
                <SourceMarker factId={fu.id} />
              </div>
            </dd>
          </div>
        )}
        {exam && (
          <div className={styles.row}>
            <dt>Last related examination</dt>
            <dd>
              <div className={styles.line}>
                <FactValue factId={exam.id}>{formatDate(exam.performedOn)}</FactValue>
                <span className={styles.meta}>{exam.examName}</span>
                <SourceMarker factId={exam.id} />
              </div>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
