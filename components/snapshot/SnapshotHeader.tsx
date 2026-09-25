/** Identity — Alex Rowan owns this space. Then when the record was updated, and from what. */
import type { DocumentRecord } from "@/lib/model/types";
import { formatDate, formatDateTime } from "@/lib/text/dates";
import AddRecord from "@/components/add-record/AddRecord";
import styles from "./snapshot.module.css";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

type Props = { name: string; lastUpdated: string; updatedFrom: DocumentRecord | null };

export default function SnapshotHeader({ name, lastUpdated, updatedFrom }: Props) {
  return (
    <header className={styles.identity}>
      <span className={styles.monogram} aria-hidden="true">
        {initials(name)}
      </span>
      <div className={styles.identityText}>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.provenanceLine}>
          {updatedFrom
            ? `Updated from ${updatedFrom.title} · ${formatDate(updatedFrom.date)}`
            : `Record updated ${formatDateTime(lastUpdated)}`}
        </p>
      </div>
      <div className={styles.identityAction}>
        <AddRecord />
      </div>
    </header>
  );
}
