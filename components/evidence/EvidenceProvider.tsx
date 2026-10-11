"use client";
/**
 * EvidenceProvider — lets any view open the right-side Evidence Drawer for a source fact or a
 * calculated claim, with no network call (the page passes the whole EvidenceIndex).
 * Spec: `spec.md > Evidence Drawer`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { EvidenceIndex, EvidenceRef } from "@/lib/evidence/index";
import EvidenceDrawer from "./EvidenceDrawer";
import styles from "./evidence.module.css";
import DocumentViewerModal from "./DocumentViewerModal";

type Ctx = {
  index: EvidenceIndex;
  open: (ref: EvidenceRef) => void;
  visualDirection?: "proposal-1";
};

const EvidenceContext = createContext<Ctx | null>(null);

export function useEvidence(): Ctx {
  const ctx = useContext(EvidenceContext);
  if (!ctx)
    throw new Error("useEvidence must be used inside <EvidenceProvider>");
  return ctx;
}

export default function EvidenceProvider({
  index,
  children,
  visualDirection = "proposal-1",
}: {
  index: EvidenceIndex;
  children: React.ReactNode;
  visualDirection?: "proposal-1";
}) {
  const [stack, setStack] = useState<EvidenceRef[]>([]);
  const [viewer, setViewer] = useState<{
    documentId: string;
    page: number;
  } | null>(null);

  const open = useCallback((ref: EvidenceRef) => setStack([ref]), []);
  const push = useCallback(
    (ref: EvidenceRef) => setStack((s) => [...s, ref]),
    [],
  );
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => {
    setViewer(null);
    setStack([]);
  }, []);

  const value = useMemo(() => ({ index, open, visualDirection }), [index, open, visualDirection]);

  return (
    <EvidenceContext.Provider value={value}>
      <div
        className={stack.length ? styles.readingWithEvidence : styles.reading}
      >
        {children}
      </div>
      <EvidenceDrawer
        visualDirection={visualDirection}
        index={index}
        current={stack[stack.length - 1] ?? null}
        canGoBack={stack.length > 1}
        onBack={back}
        onClose={close}
        onPush={push}
        onOpenDocument={(documentId, page) => setViewer({ documentId, page })}
        viewerOpen={viewer !== null}
      />
      {viewer && (
        <DocumentViewerModal
          document={index.documents[viewer.documentId]}
          documentUrlBase={index.documentUrlBase}
          page={viewer.page}
          onClose={() => setViewer(null)}
        />
      )}
    </EvidenceContext.Provider>
  );
}
