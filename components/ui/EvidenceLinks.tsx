"use client";
/**
 * Inline evidence affordances:
 *  - FactValue: a value that opens its SOURCE FACT in the drawer
 *  - SourceMarker: a document chip that opens the same fact (used in History / Summary)
 *  - SourceRef: a QUIET source reference for Home — available, never dominant
 *  - CalculatedLabel: a visibly "derived" label that opens "How this was determined"
 */
import { Fragment } from "react";
import { useEvidence } from "@/components/evidence/EvidenceProvider";
import { documentShortLabel } from "@/lib/evidence/index";
import { DocIcon } from "@/components/shell/icons";
import styles from "./ui.module.css";
import VisualIcon from "./VisualIcon";

export function FactValue({
  factId,
  children,
  className,
}: {
  factId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { open } = useEvidence();
  return (
    <button
      type="button"
      className={
        className ? `${styles.factValue} ${className}` : styles.factValue
      }
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

const DOC_TYPE_SHORT: Record<string, string> = {
  lab_report: "Lab report",
  imaging_report: "Imaging report",
  consultation_note: "Consultation note",
  prescription: "Prescription",
  other: "Document",
};

/**
 * The MRI source signature: "Lab report · 27 Jan 2026 · p. 2". Quiet, consistent, tappable;
 * opens the evidence drawer / sheet. The page is the VERIFIED page of the fact, shown only when
 * the document has more than one page (where it genuinely helps).
 */
export function SourceRef({ factId }: { factId: string }) {
  const { open, index } = useEvidence();
  const fact = index.facts[factId];
  const doc = fact ? index.documents[fact.source.documentId] : undefined;
  if (!fact || !doc) return null;
  const type = DOC_TYPE_SHORT[doc.documentType] ?? doc.title;
  const date = documentShortLabel(doc).split(" · ")[1];
  const page = doc.pageCount > 1 ? ` · p. ${fact.source.page}` : "";
  return (
    <button
      type="button"
      className={styles.sourceRef}
      data-evidence-kind="source"
      onClick={() => open({ type: "fact", id: factId })}
      aria-label={`Show evidence: ${type}, ${date}, page ${fact.source.page}`}
    >
      <DocIcon />
      <span>
        {type} · {date}
        {page}
      </span>
    </button>
  );
}

/** `label` (optional): the wording shown in place of the claim's headline; the drawer still shows the headline. */
export function CalculatedLabel({
  claimKey,
  label,
  explanationLabel,
}: {
  claimKey: string;
  label?: string;
  explanationLabel?: string;
}) {
  const { open, index, visualDirection } = useEvidence();
  const recordbookPresentation = visualDirection === "proposal-1";
  const claim = index.claims[claimKey];
  if (!claim) return null;
  const text = label ?? claim.text;
  // a label made of "·"-separated parts ("2 ferritin results · latest in record") breaks only after a separator,
  // never inside a part; a label without separators wraps as ordinary text
  const parts = text.split(" · ");
  const inlineLabel = recordbookPresentation && Boolean(label);
  const labelContent = (
    <span className={styles.calcText}>
      {parts.length === 1
        ? text
        : parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span className={styles.calcPart}>
                {i < parts.length - 1 ? `${part} ·` : part}
              </span>
            </Fragment>
          ))}
    </span>
  );
  return (
    <button
      type="button"
      className={styles.calculated}
      data-evidence-kind="derived"
      data-calculation-layout={inlineLabel ? "inline" : undefined}
      onClick={() => open({ type: "claim", key: claimKey })}
      aria-label={recordbookPresentation ? `${text} (calculated from your records — show how this was determined)` : `${text} (derived — show how this was determined)`}
      title={recordbookPresentation ? "Calculated from your records — show how this was determined" : "Derived from your records — show how this was determined"}
    >
      {/* Shared calculation presentation; claim text and evidence semantics remain unchanged. */}
      <span className={styles.calcRun}>
        {inlineLabel ? (
          <span className={styles.calcLead}>
            <VisualIcon name="network" size={16} />
            {labelContent}
          </span>
        ) : (
          <>
            {recordbookPresentation && <VisualIcon name="network" size={16} />}
            {labelContent}
          </>
        )}
        <span className={styles.calcTag}>{explanationLabel ?? (recordbookPresentation ? (label ? "Calculated from your records" : "How this was calculated") : "derived")}</span>
      </span>
    </button>
  );
}
