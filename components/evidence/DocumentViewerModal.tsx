"use client";
/** Full source document, in the browser's built-in PDF viewer, opened at the cited page. */
import useModalFocus from "@/components/ui/useModalFocus";
import { useEffect, useRef } from "react";
import type { DocumentRecord } from "@/lib/model/types";
import { documentShortLabel } from "@/lib/evidence/index";
import styles from "./evidence.module.css";

type Props = {
  document: DocumentRecord | undefined;
  page: number;
  onClose: () => void;
};

export default function DocumentViewerModal({
  document: doc,
  page,
  onClose,
}: Props) {
  const modalRef = useModalFocus(!!doc);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (!doc) return null;
  return (
    <div
      ref={modalRef}
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Source document: ${doc.title}`}
    >
      <div className={styles.modal}>
        <div className={styles.modalTop}>
          <div>
            <p className={styles.modalTitle}>{documentShortLabel(doc)}</p>
            <p className={styles.modalMeta}>
              {doc.issuer || "Added by you"} · opened at page {page} of{" "}
              {doc.pageCount}
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            className={styles.textButton}
            onClick={onClose}
          >
            Close document
          </button>
        </div>
        <iframe
          className={styles.frame}
          src={`/api/documents/${doc.id}#page=${page}`}
          title={`${doc.title}, page ${page}`}
        />
      </div>
    </div>
  );
}
