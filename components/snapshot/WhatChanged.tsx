/** Latest approved changes retain their original fact/claim evidence references. */
import type { ChangeLine, DocumentRecord } from "@/lib/model/types";
import { formatDate } from "@/lib/text/dates";
import { CalculatedLabel, FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

function updateLabel(change: ChangeLine): string {
  if (change.ref.type === "fact") {
    return change.text.replace(/^New ferritin measurement added/, "New ferritin measurement")
      .replace(/^Oral iron marked /, "Oral iron · ");
  }
  if (change.ref.key === "rich:latest:ferritin") {
    return change.text.replace(/^(\d+) Ferritin results · latest documented date (.+)$/, "Ferritin history now contains $1 results · latest $2");
  }
  return change.text;
}

export default function WhatChanged({ document: doc, changes, compact = false, heading = "What changed" }: { document: DocumentRecord; changes: ChangeLine[]; compact?: boolean; heading?: string }) {
  // The record-wide count remains in Laboratory measurements; the update explains this document.
  const visible = compact ? changes.filter(c => c.ref.type !== "claim" || c.ref.key !== "rich:laboratory-overview") : changes;
  if (visible.length === 0) return null;
  const added = visible.filter(c => c.ref.type === "fact");
  const calculated = visible.filter(c => c.ref.type === "claim");
  const item = (c: ChangeLine) => (
    <li key={c.text} className={styles.changedItem} data-change-kind={compact ? (c.ref.type === "fact" ? "direct" : "calculated") : undefined}>
      <span className={styles.changedDot} aria-hidden="true" />
      {c.ref.type === "fact" ? (
        <span className={styles.changedLine}>
          <FactValue factId={c.ref.id} className={styles.changedText}>{compact ? updateLabel(c) : c.text}</FactValue>
          <SourceRef factId={c.ref.id} />
        </span>
      ) : (
        <span className={styles.changedLine}>
          <CalculatedLabel claimKey={c.ref.key} label={compact && c.ref.key === "rich:latest:ferritin" ? updateLabel(c) : undefined} explanationLabel={compact ? "How this was calculated" : undefined} />
        </span>
      )}
    </li>
  );
  return (
    <section className={`${styles.surface} ${styles.changed}${compact ? ` ${styles.changedCompact}` : ""}`} aria-labelledby="changed-heading">
      <div className={styles.changedHead}>
        <div>
          <h2 id="changed-heading" className={styles.changedTitle}>{heading}</h2>
          <p className={styles.changedSub}>Updated from {doc.title}{compact ? " · " : " — "}{formatDate(doc.date)}</p>
        </div>
      </div>
      {compact ? <div className={styles.changedGroups}>
        {added.length > 0 && <div className={styles.changedGroup} data-update-group="added">
          <h3 className={styles.changedGroupTitle}>Added from the document</h3>
          <ul className={styles.changedList}>{added.map(item)}</ul>
        </div>}
        {calculated.length > 0 && <div className={styles.changedGroup} data-update-group="calculated">
          <h3 className={styles.changedGroupTitle}>Calculated from your record</h3>
          <ul className={styles.changedList}>{calculated.map(item)}</ul>
        </div>}
      </div> : <ul className={styles.changedList}>{visible.map(item)}</ul>}
    </section>
  );
}
