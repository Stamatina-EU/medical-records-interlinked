/** "Your history" — navigable app destinations that lead deeper into the record. */
import Link from "next/link";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { ChevronIcon } from "@/components/shell/icons";
import styles from "./snapshot.module.css";

function monthYear(iso: string): string {
  return formatDate(iso).split(" ").slice(1).join(" ");
}

/** A small, unlabelled trace of documented points in time order (values for iron, dates for imaging). */
function Trace({ points }: { points: SnapshotView["history"][number]["points"] }) {
  if (points.length === 0) return null;
  const w = 64;
  const h = 20;
  const pad = 3;
  const t = points.map((p) => new Date(`${p.date}T00:00:00Z`).getTime());
  const t0 = Math.min(...t);
  const t1 = Math.max(...t);
  const x = (i: number) => pad + (t1 === t0 ? (w - 2 * pad) / 2 : ((t[i] - t0) / (t1 - t0)) * (w - 2 * pad));
  const values = points.map((p) => p.value);
  const numeric = values.every((v) => v !== null);
  const vs = values.filter((v): v is number => v !== null);
  const v0 = Math.min(...vs);
  const v1 = Math.max(...vs);
  const y = (i: number) =>
    numeric && v1 !== v0 ? h - pad - (((values[i] as number) - v0) / (v1 - v0)) * (h - 2 * pad) : h / 2;
  return (
    <svg className={styles.trace} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {numeric ? (
        <polyline points={points.map((_, i) => `${x(i)},${y(i)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1" />
      ) : (
        <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} stroke="currentColor" strokeWidth="1" />
      )}
      {points.map((_, i) => (
        <circle key={i} cx={x(i)} cy={y(i)} r="1.75" fill="currentColor" />
      ))}
    </svg>
  );
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
                <span className={styles.destMeta}>
                  {t.count} {t.countNoun}
                </span>
                {t.firstDate && t.lastDate && (
                  <span className={styles.destMeta}>
                    {monthYear(t.firstDate)} – {monthYear(t.lastDate)}
                  </span>
                )}
                {t.extra && <span className={styles.destMeta}>Also: {t.extra}</span>}
              </span>
              <Trace points={t.points} />
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
