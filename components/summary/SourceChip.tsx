"use client";
/** Compact source marker for the Doctor Summary: "[1]" / "[2, 4]" — opens the evidence drawer. */
import { useEvidence } from "@/components/evidence/EvidenceProvider";
import type { SummaryRef } from "@/lib/summary/compose";
import styles from "./summary.module.css";

export default function SourceChip({ refItem, numbers, derived }: { refItem: SummaryRef; numbers: number[]; derived: boolean }) {
  const { open } = useEvidence();
  if (numbers.length === 0) return null;
  const label = `${numbers.length === 1 ? "Source" : "Sources"} ${numbers.join(", ")}`;
  return (
    <button
      type="button"
      className={`${styles.chip} ${derived ? styles.calculationChip : ""}`}
      onClick={() => open(refItem.type === "fact" ? { type: "fact", id: refItem.id } : { type: "claim", key: refItem.key })}
      aria-label={`${derived ? "Derived — " : ""}${label}: show evidence`}
    >
      {derived && <span className={styles.chipDerived}>derived · </span>}
      {numbers.join(", ")}
    </button>
  );
}
