/**
 * "What changed" — appears only after a new record is approved. Its first appearance is the
 * product's payoff: the patient added evidence, approved it, and their documented picture changed.
 * Every line opens its evidence (a source fact or a derived claim).
 */
import type { ChangeLine, DocumentRecord } from "@/lib/model/types";
import { formatDate } from "@/lib/text/dates";
import { CalculatedLabel, FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

export default function WhatChanged({ document: doc, changes, compact = false }: { document: DocumentRecord; changes: ChangeLine[]; compact?: boolean }) {
  if (changes.length === 0) return null;
  return (
    <section className={`${styles.surface} ${styles.changed}${compact ? ` ${styles.changedCompact}` : ""}`} aria-labelledby="changed-heading">
      <div className={styles.changedHead}>
        <div>
          <h2 id="changed-heading" className={styles.changedTitle}>
            What changed
          </h2>
          <p className={styles.changedSub}>
            Updated from {doc.title}{compact ? " · " : " — "}{formatDate(doc.date)}
          </p>
        </div>
      </div>
      <ul className={styles.changedList}>
        {changes.map((c) => (
          <li key={c.text} className={`${styles.changedItem}${compact && c.ref.type === "claim" && c.ref.key.startsWith("rich:latest:") ? ` ${styles.changedWide}` : ""}`} data-change-kind={compact ? (c.ref.type === "fact" ? "direct" : "calculated") : undefined}>
            <span className={styles.changedDot} aria-hidden="true" />
            {c.ref.type === "fact" ? (
              <span className={styles.changedLine}>
                <FactValue factId={c.ref.id} className={styles.changedText}>
                  {c.text}
                </FactValue>
                <SourceRef factId={c.ref.id} />
              </span>
            ) : (
              <span className={styles.changedLine}>
                <CalculatedLabel claimKey={c.ref.key} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
