/** Identity — Alex Rowan owns this space. Then, quietly, how the picture was built. */
import { formatDateTime } from "@/lib/text/dates";
import { PlusIcon } from "@/components/shell/icons";
import styles from "./snapshot.module.css";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

type Props = { name: string; lastUpdated: string; documentCount: number };

export default function SnapshotHeader({ name, lastUpdated, documentCount }: Props) {
  return (
    <header className={styles.identity}>
      <span className={styles.monogram} aria-hidden="true">
        {initials(name)}
      </span>
      <div className={styles.identityText}>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.provenanceLine}>
          Built from {documentCount} source document{documentCount === 1 ? "" : "s"} · updated {formatDateTime(lastUpdated)}
        </p>
      </div>
      {/* Add record is wired up in slice 4 (spec.md > Add Record Modal and Processing State). */}
      <button type="button" className={styles.addRecord} disabled title="Available after the next build step">
        <PlusIcon />
        <span>Add record</span>
      </button>
    </header>
  );
}
