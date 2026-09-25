"use client";
/** Right-side Evidence Drawer. Spec: `spec.md > Evidence Drawer`. */
import { useEffect, useRef } from "react";
import type { EvidenceIndex, EvidenceRef } from "@/lib/evidence/index";
import SourceFactView from "./SourceFactView";
import CalculatedClaimView from "./CalculatedClaimView";
import styles from "./evidence.module.css";

type Props = {
  index: EvidenceIndex;
  current: EvidenceRef | null;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onPush: (ref: EvidenceRef) => void;
  onOpenDocument: (documentId: string, page: number) => void;
  viewerOpen: boolean;
};

export default function EvidenceDrawer({ index, current, canGoBack, onBack, onClose, onPush, onOpenDocument, viewerOpen }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpen = current !== null;

  useEffect(() => {
    if (isOpen) {
      if (!returnFocus.current) returnFocus.current = document.activeElement as HTMLElement | null;
      closeRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [isOpen, current]);

  useEffect(() => {
    if (!isOpen || viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, viewerOpen, onClose]);

  if (!current) return null;

  const fact = current.type === "fact" ? index.facts[current.id] : null;
  const claim = current.type === "claim" ? index.claims[current.key] : null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Evidence">
        <div className={styles.drawerTop}>
          {canGoBack ? (
            <button type="button" className={styles.textButton} onClick={onBack}>
              ← Back
            </button>
          ) : (
            <span className={styles.drawerKicker}>Evidence</span>
          )}
          <button type="button" ref={closeRef} className={styles.textButton} onClick={onClose} aria-label="Close evidence">
            Close
          </button>
        </div>
        <div className={styles.drawerBody}>
          {fact && <SourceFactView fact={fact} index={index} onOpenDocument={onOpenDocument} />}
          {claim && <CalculatedClaimView claim={claim} index={index} onOpenFact={(id) => onPush({ type: "fact", id })} />}
          {!fact && !claim && <p className={styles.muted}>This item is no longer in the history.</p>}
        </div>
      </aside>
    </>
  );
}
