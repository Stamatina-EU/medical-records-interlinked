"use client";
/** Right-side Evidence Drawer. Spec: `spec.md > Evidence Drawer`. */
import { useEffect, useRef, useState } from "react";
import type { EvidenceIndex, EvidenceRef } from "@/lib/evidence/index";
import SourceFactView from "./SourceFactView";
import CalculatedClaimView from "./CalculatedClaimView";
import styles from "./evidence.module.css";
import visual from "@/components/ui/recordbookVisual.module.css";

type Props = {
  visualDirection?: "proposal-1";
  index: EvidenceIndex;
  current: EvidenceRef | null;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onPush: (ref: EvidenceRef) => void;
  onOpenDocument: (documentId: string, page: number) => void;
  viewerOpen: boolean;
};

export default function EvidenceDrawer({
  visualDirection,
  index,
  current,
  canGoBack,
  onBack,
  onClose,
  onPush,
  onOpenDocument,
  viewerOpen,
}: Props) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpen = current !== null;
  const [modal, setModal] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const sync = () => setModal(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!returnFocus.current)
        returnFocus.current = document.activeElement as HTMLElement | null;
      closeRef.current?.focus({ preventScroll: true });
    } else if (returnFocus.current) {
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [isOpen, current]);

  useEffect(() => {
    if (!isOpen || viewerOpen) return;
    const media = window.matchMedia("(max-width: 1100px)");
    const previousOverflow = document.body.style.overflow;
    const sync = () => {
      document.body.style.overflow = media.matches
        ? "hidden"
        : previousOverflow;
    };
    sync();
    media.addEventListener("change", sync);
    const trap = (e: KeyboardEvent) => {
      if (!media.matches || e.key !== "Tab") return;
      const items = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button,a[href],[tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", trap);
      media.removeEventListener("change", sync);
    };
  }, [isOpen, viewerOpen]);

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
      <aside
        ref={drawerRef}
        className={`${styles.drawer} ${styles.artDrawer} ${visual.theme} ${visualDirection === "proposal-1" ? `${visual.proposalTheme} ${styles.proposalDrawer}` : ""}`}
        data-evidence-type={current.type}
        role="dialog"
        aria-label="Evidence"
        aria-modal={modal ? true : undefined}
      >
        <div className={styles.drawerTop}>
          {canGoBack ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={onBack}
            >
              ← Back
            </button>
          ) : (
            <span className={styles.drawerKicker}>Evidence</span>
          )}
          <button
            type="button"
            ref={closeRef}
            className={styles.textButton}
            onClick={onClose}
            aria-label="Close evidence"
          >
            Close
          </button>
        </div>
        <div className={styles.drawerBody}>
          {fact && (
            <SourceFactView
              fact={fact}
              index={index}
              onOpenDocument={onOpenDocument}
            />
          )}
          {claim && (
            <CalculatedClaimView
              claim={claim}
              index={index}
              onOpenFact={(id) => onPush({ type: "fact", id })}
            />
          )}
          {!fact && !claim && (
            <p className={styles.muted}>
              This item is no longer in the history.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
