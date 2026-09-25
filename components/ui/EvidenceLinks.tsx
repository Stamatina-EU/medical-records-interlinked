"use client";
/**
 * Inline evidence affordances:
 *  - FactValue: a value that opens its SOURCE FACT in the drawer
 *  - SourceMarker: a document chip that opens the same fact (used in History / Summary)
 *  - SourceRef: a QUIET source reference for Home — available, never dominant
 *  - CalculatedLabel: a visibly "derived" label that opens "How this was determined"
 */
import { useEvidence } from "@/components/evidence/EvidenceProvider";
import { documentShortLabel } from "@/lib/evidence/index";
import { DocIcon } from "@/components/shell/icons";
import styles from "./ui.module.css";

export function FactValue({ factId, children, className }: { factId: string; children: React.ReactNode; className?: string }) {
  const { open } = useEvidence();
  return (
    <button
      type="button"
      className={className ? `${styles.factValue} ${className}` : styles.factValue}
      onClick={() => open({ type: "fact", id: factId })}
    >
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

export function SourceRef({ factId, prefix = "From" }: { factId: string; prefix?: string }) {
  const { open, index } = useEvidence();
  const fact = index.facts[factId];
  const doc = fact ? index.documents[fact.source.documentId] : undefined;
  if (!fact || !doc) return null;
  return (
    <button
      type="button"
      className={styles.sourceRef}
      onClick={() => open({ type: "fact", id: factId })}
      aria-label={`Show evidence: ${documentShortLabel(doc)}, page ${fact.source.page}`}
    >
      <DocIcon />
      <span>
        {prefix} {doc.title.toLowerCase()} · {documentShortLabel(doc).split(" · ")[1]}
      </span>
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
      aria-label={`${claim.text} (derived — show how this was determined)`}
      title="Derived from your records — show how this was determined"
    >
      <span className={styles.calcText}>{claim.text}</span>
      <span className={styles.calcTag}>derived</span>
    </button>
  );
}
