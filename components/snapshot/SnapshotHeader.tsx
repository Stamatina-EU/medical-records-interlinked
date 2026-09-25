/** Snapshot header — patient, "Documented health history", last updated, Add record. */
import { formatDateTime } from "@/lib/text/dates";
import styles from "./snapshot.module.css";

export default function SnapshotHeader({ name, lastUpdated }: { name: string; lastUpdated: string }) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>
          Documented health history <span className={styles.synthetic}>Synthetic demo record</span>
        </p>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.updated}>Last updated {formatDateTime(lastUpdated)}</p>
      </div>
      {/* Add record is wired up in slice 4 (spec.md > Add Record Modal and Processing State). */}
      <button type="button" className={styles.addRecord} disabled title="Available after the next build step">
        Add record
      </button>
    </header>
  );
}
