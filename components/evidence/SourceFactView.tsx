"use client";
/** Drawer view for a SOURCE FACT: value, document, date, page, verified excerpt. */
import type { SourceFact } from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import { factHeadline } from "@/lib/evidence/index";
import { formatDate } from "@/lib/text/dates";
import styles from "./evidence.module.css";

type Props = {
  fact: SourceFact;
  index: EvidenceIndex;
  onOpenDocument: (documentId: string, page: number) => void;
};

export default function SourceFactView({ fact, index, onOpenDocument }: Props) {
  const doc = index.documents[fact.source.documentId];
  const { label, value } = factHeadline(fact, index.episodes);

  return (
    <div>
      <p className={styles.kind}>Source fact</p>
      <h2 className={styles.factLabel}>{label}</h2>
      <p className={styles.factValue}>{value}</p>
      {fact.kind === "lab_measurement" && fact.refText && (
        <p className={styles.factMeta}>
          Supplied range {fact.refText} {fact.unit} · measured {formatDate(fact.measuredOn)}
        </p>
      )}
      {fact.kind === "follow_up" && <p className={styles.factMeta}>Recommended {formatDate(fact.recommendedOn)}</p>}
      {fact.kind === "imaging_exam" && <p className={styles.factMeta}>{fact.statement}</p>}

      <h3 className={styles.sectionHeading}>Source</h3>
      {doc ? (
        <dl className={styles.sourceList}>
          <div>
            <dt>Document</dt>
            <dd>{doc.title}</dd>
          </div>
          <div>
            <dt>Issued by</dt>
            <dd>{doc.issuer}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(doc.date)}</dd>
          </div>
          <div>
            <dt>Page</dt>
            <dd>
              {fact.source.page} of {doc.pageCount}
            </dd>
          </div>
        </dl>
      ) : (
        <p className={styles.muted}>Source document not found.</p>
      )}

      <h3 className={styles.sectionHeading}>Evidence</h3>
      <blockquote className={styles.excerpt}>
        <mark>{fact.source.verifiedExcerpt}</mark>
      </blockquote>
      <p className={styles.excerptNote}>Exact wording from the source document, page {fact.source.page}.</p>

      {doc && (
        <button type="button" className={styles.secondaryButton} onClick={() => onOpenDocument(doc.id, fact.source.page)}>
          Open source document
        </button>
      )}
    </div>
  );
}
