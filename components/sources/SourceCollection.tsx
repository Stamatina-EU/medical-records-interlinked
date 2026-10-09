"use client";
import { useState } from "react";
import Link from "next/link";
import type { DocumentRecord, SourceFact } from "@/lib/model/types";
import { formatDate } from "@/lib/text/dates";
import { FactValue } from "@/components/ui/EvidenceLinks";
import { factHeadline } from "@/lib/evidence/index";
import { useEvidence } from "@/components/evidence/EvidenceProvider";
import DocumentViewerModal from "@/components/evidence/DocumentViewerModal";
import styles from "./sources.module.css";
const TYPES: Record<string, string> = {
  lab_report: "Laboratory report",
  prescription: "Prescription",
  consultation_note: "Consultation note",
  imaging_report: "Imaging report",
  other: "Document",
};
export default function SourceCollection({
  documents,
  facts,
}: {
  documents: DocumentRecord[];
  facts: SourceFact[];
}) {
  const [viewer, setViewer] = useState<DocumentRecord | null>(null);
  const { index } = useEvidence();
  return (
    <>
      <header className={styles.header}>
        <p className={styles.kicker}>The evidence collection</p>
        <h1>Sources</h1>
        <p>
          The documents behind{" "}
          {index.facts && documents.length ? "your record" : "this record"}.
          Fictional patient · synthetic demo.
        </p>
      </header>
      <div className={styles.collectionHead}>
        <span>
          {documents.length} source document{documents.length === 1 ? "" : "s"}
        </span>
        <span>Document date · newest first</span>
      </div>
      {documents.length === 0 && (
        <p className={styles.empty}>
          No source documents yet. <Link href="/">Add your first record.</Link>
        </p>
      )}
      <ol className={styles.collection}>
        {[...documents]
          .sort(
            (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
          )
          .map((doc) => {
            const supports = facts.filter(
              (f) => f.source.documentId === doc.id,
            );
            const topics = [
              ...new Set(
                supports.map((f) =>
                  f.kind === "medication_status" ? "iron" : f.topic,
                ),
              ),
            ];
            return (
              <li key={doc.id} id={doc.id} className={styles.document}>
                <div className={styles.date}>
                  <time dateTime={doc.date}>{formatDate(doc.date)}</time>
                  <span>{TYPES[doc.documentType]}</span>
                </div>
                <div className={styles.body}>
                  <h2>{doc.title}</h2>
                  <p>
                    {doc.issuer || "Added by you"} · {doc.pageCount} page
                    {doc.pageCount === 1 ? "" : "s"}
                  </p>
                  <div className={styles.supports}>
                    <span>Supports</span>
                    {topics.map((topic) => (
                      <Link key={topic} href={"/history/" + topic}>
                        {topic === "iron" ? "Iron / Ferritin" : "Imaging"} ↗
                      </Link>
                    ))}
                  </div>
                  <details>
                    <summary>
                      {supports.length} fact{supports.length === 1 ? "" : "s"}{" "}
                      from this document
                    </summary>
                    <ul>
                      {supports.map((f) => {
                        const h = factHeadline(f, index.episodes);
                        return (
                          <li key={f.id}>
                            <FactValue factId={f.id}>
                              {h.label} — {h.value}
                              <span className={styles.page}>
                                {" "}
                                · p. {f.source.page}
                              </span>
                            </FactValue>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </div>
                <button
                  type="button"
                  className={styles.open}
                  onClick={() => setViewer(doc)}
                  aria-label={"Read " + doc.title + ", " + formatDate(doc.date)}
                >
                  Read document ↗
                </button>
              </li>
            );
          })}
      </ol>
      {viewer && (
        <DocumentViewerModal
          document={viewer}
          page={1}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
