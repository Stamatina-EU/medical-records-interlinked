/**
 * "Your record at a glance" — a concise record overview: how many source documents back this
 * record, of which kinds, and over what span. It summarises the RECORD (evidence coverage),
 * never the person's health, and it doesn't repeat the sections below.
 */
import Link from "next/link";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { DocIcon } from "@/components/shell/icons";
import styles from "./snapshot.module.css";

export default function HealthSummary({ summary }: { summary: SnapshotView["summary"] }) {
  return (
    <section className={`${styles.surface} ${styles.summary}`} aria-labelledby="summary-heading">
      <div className={styles.summaryMain}>
        <h2 id="summary-heading" className={styles.moduleTitle}>
          Your record at a glance
        </h2>
        {summary.firstDocumentDate && summary.lastDocumentDate && (
          <p className={styles.moduleNote}>
            What your documented record contains · {formatDate(summary.firstDocumentDate)} to{" "}
            {formatDate(summary.lastDocumentDate)}
          </p>
        )}
        <p className={styles.coverage}>
          <span className={styles.coverageIcon} aria-hidden="true">
            <DocIcon size={18} />
          </span>
          <span>
            <strong>
              {summary.documentCount} source document{summary.documentCount === 1 ? "" : "s"}
            </strong>{" "}
            · {summary.documentTypes.map((t) => `${t.count} ${t.label}`).join(", ")}
          </span>
        </p>
        <p className={styles.coverageNote}>Everything on this page links back to one of them.</p>
      </div>
      <Link href="/summary" className={styles.summaryLink}>
        Open Doctor Summary →
      </Link>
    </section>
  );
}
