"use client";
/**
 * Add record → processing → review → apply. Spec: `spec.md > Add Record Modal and Processing
 * State`, `spec.md > Review Panel`; PRD: `prd.md > Adding a Record and Reviewing Proposed Changes`.
 *
 * The patient approves EVIDENCE (verified source facts). Consequences are previewed by the pure
 * engine and are not approvable themselves. Nothing changes until Apply; Apply sends only ids.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Proposal, TrustedState } from "@/lib/model/types";
import { preview } from "@/lib/engine/apply";
import { formatDate } from "@/lib/text/dates";
import { PlusIcon } from "@/components/shell/icons";
import styles from "./addRecord.module.css";
import { statusLabel } from "@/lib/text/status";

type Phase =
  | { kind: "idle" }
  | { kind: "processing"; file: File }
  | { kind: "review"; proposal: Proposal; state: TrustedState; rejected: Set<string> }
  | { kind: "applying"; proposal: Proposal; state: TrustedState; rejected: Set<string> }
  | { kind: "unusable" }
  | { kind: "no_changes" }
  | { kind: "unavailable"; file: File };

function factHeadline(f: Proposal["facts"][number], state: TrustedState): { label: string; value: string } {
  if (f.kind === "lab_measurement") {
    const m = f;
    return {
      label: "Ferritin",
      value: `${m.value} ${m.unit}${m.refText ? ` · supplied range ${m.refText} ${m.unit}` : ""} · ${formatDate(m.measuredOn)}`,
    };
  }
  const e = f;
  const name = (state.episodes.find((ep) => ep.id === e.episodeId)?.name ?? "Medication").split(" (")[0];
  return { label: name, value: `${statusLabel(e.status)} · documented ${formatDate(e.documentedOn)}` };
}

export default function AddRecord() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const submit = useCallback(async (file: File) => {
    setPhase({ kind: "processing", file });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/records/extract", { method: "POST", body });
      const data = await res.json().catch(() => ({ status: "unavailable" }));
      if (data.status === "proposal") {
        setPhase({ kind: "review", proposal: data.proposal, state: data.state, rejected: new Set() });
      } else if (data.status === "no_changes") {
        setPhase({ kind: "no_changes" });
      } else if (data.status === "unusable") {
        setPhase({ kind: "unusable" });
      } else {
        setPhase({ kind: "unavailable", file });
      }
    } catch {
      setPhase({ kind: "unavailable", file });
    }
  }, []);

  const close = useCallback(async () => {
    if (phase.kind === "review") {
      // Cancel discards the proposal; nothing is imported.
      await fetch("/api/records/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: phase.proposal.proposalId }),
      }).catch(() => undefined);
    }
    setPhase({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, [phase]);

  const applyApproved = useCallback(async () => {
    if (phase.kind !== "review") return;
    const approved = phase.proposal.facts.filter((f) => !phase.rejected.has(f.id)).map((f) => f.id);
    if (approved.length === 0) return;
    setPhase({ ...phase, kind: "applying" });
    try {
      const res = await fetch("/api/records/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: phase.proposal.proposalId, approvedFactIds: approved }),
      });
      if (!res.ok) throw new Error("apply failed");
      setPhase({ kind: "idle" });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setPhase({ ...phase, kind: "review" });
    }
  }, [phase, router]);

  useEffect(() => {
    if (phase.kind === "idle" || phase.kind === "processing" || phase.kind === "applying") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, close]);

  return (
    <>
      <button type="button" className={styles.addRecord} onClick={() => inputRef.current?.click()}>
        <PlusIcon />
        <span>Add record</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className={styles.fileInput}
        aria-label="Choose a PDF record to add"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void submit(file);
        }}
      />
      {phase.kind !== "idle" && <Panel phase={phase} setPhase={setPhase} onClose={close} onApply={applyApproved} onRetry={submit} />}
    </>
  );
}

function Panel({
  phase,
  setPhase,
  onClose,
  onApply,
  onRetry,
}: {
  phase: Exclude<Phase, { kind: "idle" }>;
  setPhase: (p: Phase) => void;
  onClose: () => void;
  onApply: () => void;
  onRetry: (file: File) => void;
}) {
  const busy = phase.kind === "processing" || phase.kind === "applying";
  return (
    <div className={styles.backdrop}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="add-record-title">
        <div className={styles.panelTop}>
          <h2 id="add-record-title" className={styles.panelTitle}>
            {phase.kind === "review" || phase.kind === "applying" ? "Review this record" : "Add record"}
          </h2>
          {!busy && (
            <button type="button" className={styles.textButton} onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <div className={styles.panelBody}>
          {phase.kind === "processing" && (
            <div className={styles.message} aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              <p className={styles.messageTitle}>Reading this record…</p>
              <p className={styles.messageText}>Extracted facts will be shown for your review before anything changes.</p>
            </div>
          )}
          {phase.kind === "unusable" && (
            <Message title="This record couldn't be read into structured facts." text="Your history hasn't changed.">
              <button type="button" className={styles.secondary} onClick={onClose}>
                Close
              </button>
            </Message>
          )}
          {phase.kind === "no_changes" && (
            <Message title="No new history changes found." text="Your documented history hasn't changed.">
              <button type="button" className={styles.secondary} onClick={onClose}>
                Close
              </button>
            </Message>
          )}
          {phase.kind === "unavailable" && (
            <Message title="We couldn't read this record just now." text="Your history hasn't changed.">
              <button type="button" className={styles.primary} onClick={() => onRetry(phase.file)}>
                Try again
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Cancel
              </button>
            </Message>
          )}
          {(phase.kind === "review" || phase.kind === "applying") && (
            <Review phase={phase} setPhase={setPhase} onCancel={onClose} onApply={onApply} />
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className={styles.message} aria-live="polite">
      <p className={styles.messageTitle}>{title}</p>
      <p className={styles.messageText}>{text}</p>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}

function Review({
  phase,
  setPhase,
  onCancel,
  onApply,
}: {
  phase: Extract<Phase, { kind: "review" | "applying" }>;
  setPhase: (p: Phase) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const { proposal, state, rejected } = phase;
  const approvedIds = proposal.facts.filter((f) => !rejected.has(f.id)).map((f) => f.id);
  const lines = useMemo(() => preview(state, proposal, approvedIds), [state, proposal, approvedIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const doc = proposal.document;
  const toggle = (id: string) => {
    if (phase.kind !== "review") return;
    const next = new Set(rejected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPhase({ ...phase, rejected: next });
  };

  return (
    <div>
      <p className={styles.docLine}>
        {doc.title} · {formatDate(doc.date)} · {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}
      </p>

      <h3 className={styles.sectionHeading}>Verified against this record</h3>
      <p className={styles.sectionNote}>Matched to the source wording shown below.</p>
      <ul className={styles.facts}>
        {proposal.facts.map((f) => {
          const { label, value } = factHeadline(f, state);
          const isRejected = rejected.has(f.id);
          return (
            <li key={f.id} className={isRejected ? `${styles.fact} ${styles.factRejected}` : styles.fact}>
              <div className={styles.factHead}>
                <div>
                  <p className={styles.factLabel}>{label}</p>
                  <p className={styles.factValue}>{value}</p>
                </div>
                <button
                  type="button"
                  className={isRejected ? styles.toggleRejected : styles.toggle}
                  aria-pressed={isRejected}
                  onClick={() => toggle(f.id)}
                  disabled={phase.kind === "applying"}
                >
                  {isRejected ? "Excluded · undo" : "Exclude"}
                </button>
              </div>
              <blockquote className={styles.excerpt}>{f.source.verifiedExcerpt}</blockquote>
              <p className={styles.excerptNote}>Exact wording from this record, page {f.source.page}.</p>
            </li>
          );
        })}
      </ul>

      {proposal.excludedCount > 0 && (
        <p className={styles.leftOut}>
          {proposal.excludedCount} extracted item{proposal.excludedCount === 1 ? "" : "s"} could not be verified against the
          source document and {proposal.excludedCount === 1 ? "was" : "were"} left out.
        </p>
      )}

      <h3 className={styles.sectionHeading}>This would also update…</h3>
      {lines.length > 0 ? (
        <ul className={styles.consequences}>
          {lines.map((l) => (
            <li key={l.text}>{l.text}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.messageText}>Nothing — every fact from this record is excluded.</p>
      )}

      <div className={styles.reviewFooter}>
        <div className={styles.reviewActions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={phase.kind === "applying"}>
            Cancel
          </button>
          <button type="button" className={styles.primary} onClick={onApply} disabled={approvedIds.length === 0 || phase.kind === "applying"}>
            {phase.kind === "applying" ? "Adding…" : rejected.size === 0 ? "Add all to my record" : "Add selected"}
          </button>
        </div>
        <p className={styles.reviewNote}>Nothing changes in your record until you choose what to add.</p>
      </div>
    </div>
  );
}
