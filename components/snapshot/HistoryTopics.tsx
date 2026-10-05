/**
 * "Your history" — navigable app destinations that lead deeper into the record.
 * Cards carry navigation metadata only (title, date span, related treatment). Medical counts
 * live in "Latest in your record", where they open their derived claim.
 */
import Link from "next/link";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { ChevronIcon } from "@/components/shell/icons";
import styles from "./snapshot.module.css";

function monthYear(iso: string): string {
  return formatDate(iso).split(" ").slice(1).join(" ");
}

export default function HistoryTopics({ topics }: { topics: SnapshotView["history"] }) {
  if (topics.length === 0) return null;
  return (
    <section className={styles.module} aria-labelledby="history-heading">
      <div className={styles.moduleHead}>
        <h2 id="history-heading" className={styles.moduleTitle}>
          Your history
        </h2>
      </div>
      <ul className={styles.destinations}>
        {topics.map((t) => (
          <li key={t.topic}>
            <Link href={`/history/${t.topic}`} className={`${styles.surface} ${styles.destination}`}>
              <span className={styles.destText}>
                <span className={styles.destTitle}>{t.title}</span>
                {t.firstDate && t.lastDate && (
                  <span className={styles.destMeta}>
                    {monthYear(t.firstDate)} – {monthYear(t.lastDate)}
                  </span>
                )}
                {t.extra && <span className={styles.destMeta}>Also: {t.extra}</span>}
              </span>
              <span className={styles.destChevron}>
                <ChevronIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
