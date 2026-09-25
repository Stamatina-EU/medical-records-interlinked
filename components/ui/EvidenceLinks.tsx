"use client";
/**
 * Inline evidence affordances:
 *  - FactValue: a value that opens its SOURCE FACT in the drawer
 *  - SourceMarker: a small document chip that opens the same fact
 *  - CalculatedLabel: a visibly "derived" label that opens "How this was determined"
 */
import { useEvidence } from "@/components/evidence/EvidenceProvider";
import { documentShortLabel } from "@/lib/evidence/index";
import styles from "./ui.module.css";

export function FactValue({ factId, children }: { factId: string; children: React.ReactNode }) {
  const { open } = useEvidence();
  return (
    <button type="button" className={styles.factValue} onClick={() => open({ type: "fact", id: factId })}>
      {children}
    </button>
  );
}

export function SourceMarker({ factId }: { factId: string }) {
  const { open, index } = useEvidence();
  const fact = index.facts[factId];
  const doc = fact ? index.documents[fact.source.documentId] : undefined;
  if (!fact || !doc) return null;
  return (
    <button
      type="button"
      className={styles.sourceMarker}
      onClick={() => open({ type: "fact", id: factId })}
      aria-label={`Source: ${documentShortLabel(doc)}, page ${fact.source.page}`}
    >
      {documentShortLabel(doc)}
    </button>
  );
}

export function CalculatedLabel({ claimKey }: { claimKey: string }) {
  const { open, index } = useEvidence();
  const claim = index.claims[claimKey];
  if (!claim) return null;
  return (
    <button
      type="button"
      className={styles.calculated}
      onClick={() => open({ type: "claim", key: claimKey })}
      aria-label={`${claim.text} (calculated — show how this was determined)`}
    >
      <span className={styles.calcTag}>Calculated</span>
      <span className={styles.calcText}>{claim.text}</span>
    </button>
  );
}
