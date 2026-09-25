/**
 * "Your record at a glance" — what the documented record contains, as deterministic counts.
 * It summarises the RECORD, never the person's health: no "healthy", "normal overall",
 * "needs attention", "concerning" or "urgent". No AI-written prose.
 */
import Link from "next/link";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import styles from "./snapshot.module.css";

export default function HealthSummary({ summary }: { summary: SnapshotView["summary"] }) {
  const stats = [
    { n: summary.documentCount, label: summary.documentCount === 1 ? "source document" : "source documents" },
    { n: summary.topicCount, label: summary.topicCount === 1 ? "topic followed over time" : "topics followed over time" },
    { n: summary.followUpCount, label: summary.followUpCount === 1 ? "follow-up on record" : "follow-ups on record" },
    { n: summary.treatmentCount, label: summary.treatmentCount === 1 ? "treatment documented" : "treatments documented" },
  ];
  return (
    <section className={`${styles.surface} ${styles.summary}`} aria-labelledby="summary-heading">
      <div className={styles.summaryHead}>
        <div>
          <h2 id="summary-heading" className={styles.moduleTitle}>
            Your record at a glance
          </h2>
          {summary.firstDocumentDate && summary.lastDocumentDate && (
            <p className={styles.moduleNote}>
              What your documented record contains · {formatDate(summary.firstDocumentDate)} to{" "}
              {formatDate(summary.lastDocumentDate)}
            </p>
          )}
        </div>
        <Link href="/summary" className={styles.summaryLink}>
          Open Doctor Summary →
        </Link>
      </div>
      <dl className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.stat}>
            <dt className={styles.statLabel}>{s.label}</dt>
            <dd className={styles.statValue}>{s.n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
