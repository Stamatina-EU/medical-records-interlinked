"use client";
/** Drawer view for a SOURCE FACT: value, document, date, page, verified excerpt. */
import type { RecordSourceFact } from "@/lib/model/rich";
import type { EvidenceIndex } from "@/lib/evidence/index";
import { factHeadline } from "@/lib/evidence/index";
import { formatDate } from "@/lib/text/dates";
import styles from "./evidence.module.css";
import VisualIcon from "@/components/ui/VisualIcon";

type Props = {
  fact: RecordSourceFact;
  index: EvidenceIndex;
  onOpenDocument: (documentId: string, page: number) => void;
};

export default function SourceFactView({ fact, index, onOpenDocument }: Props) {
  const doc = index.documents[fact.source.documentId];
  const { label, value } = factHeadline(fact, index.episodes);

  return (
    <div className={styles.sourceView} data-fact-kind={fact.kind}>
      <div className={styles.factHeader}>
        <p className={styles.kind}>
          <VisualIcon name="files" size={19} />
          Direct
        </p>
        <h2 className={styles.factLabel}>{label}</h2>
        <p className={styles.factValue}>{value}</p>
        {fact.kind === "lab_measurement" && fact.refText && (
          <p className={styles.factMeta}>
            Supplied range {fact.refText} {fact.unit} · measured{" "}
            {formatDate(fact.measuredOn)}
          </p>
        )}
        {fact.kind === "documented_incident" && (
          <p className={styles.factMeta}>
            {fact.occurredOn ? `Incident date ${formatDate(fact.occurredOn)}` : "Incident date not supplied"}
            {" · Document date "}{formatDate(fact.documentedOn)}
          </p>
        )}
        {fact.kind === "follow_up" && (
          <p className={styles.factMeta}>
            Recommended {formatDate(fact.recommendedOn)}
          </p>
        )}
        {fact.kind === "imaging_exam" && (
          <p className={styles.factMeta}>{fact.statement}</p>
        )}
      </div>
      <h3 className={styles.sectionHeading}>Exact source wording</h3>
      <blockquote className={styles.excerpt}>
        <mark>{fact.source.verifiedExcerpt}</mark>
      </blockquote>
      <p className={styles.excerptNote}>
        Checked against source wording · page {fact.source.page}
      </p>
      <h3 className={styles.sectionHeading}>Source document</h3>
      {doc ? (
        <dl className={styles.sourceList}>
          <div>
            <dt>Document</dt>
            <dd>{doc.title}</dd>
          </div>
          {doc.issuer ? (
            <div>
              <dt>Issued by</dt>
              <dd>{doc.issuer}</dd>
            </div>
          ) : (
            <div>
              <dt>Added</dt>
              <dd>By you, with Add record</dd>
            </div>
          )}
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

      <p className={styles.excerptNote}>
        {doc?.origin === "added"
          ? "Added with your approval"
          : index.profile === "rich-synthetic"
          ? "Curated synthetic baseline · source wording checked against its PDF"
          : "Approved synthetic seed fact"}
      </p>
      {doc && (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => onOpenDocument(doc.id, fact.source.page)}
        >
          Open source document
        </button>
      )}
    </div>
  );
}
