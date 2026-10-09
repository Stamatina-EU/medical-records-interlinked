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
import { reviewFactHeadline } from "@/lib/view/reviewFact";
import {
  APPROVAL_PROBLEM_TEXT,
  approvalProblem,
  canRetry,
  isUncertain,
  type ApprovalProblem,
} from "@/lib/view/approvalOutcome";
import useModalFocus from "@/components/ui/useModalFocus";
import { PlusIcon } from "@/components/shell/icons";
import styles from "./addRecord.module.css";

type Phase =
  | { kind: "idle" }
  | { kind: "choose" }
  | { kind: "processing"; file: File }
  // applyProblem: what is known about the last Add attempt that did not clearly succeed (lib/view/approvalOutcome.ts);
  // uncertainBefore: an earlier attempt's outcome is unknown, so it may already have added the record
  | {
      kind: "review";
      proposal: Proposal;
      state: TrustedState;
      rejected: Set<string>;
      applyProblem?: ApprovalProblem;
      uncertainBefore?: boolean;
    }
  | {
      kind: "applying";
      proposal: Proposal;
      state: TrustedState;
      rejected: Set<string>;
      applyProblem?: undefined;
      uncertainBefore?: boolean;
    }
  // each failure phase mirrors an actual pipeline outcome (lib/extraction/pipeline.ts)
  | { kind: "unsupported_file"; code: "not_pdf" | "too_large" | "damaged_pdf" }
  | { kind: "no_text" }
  | { kind: "no_supported_facts" }
  | { kind: "no_verified_facts" }
  | { kind: "no_changes" }
  | { kind: "processing_failed"; file: File; retryable: boolean };

const UNSUPPORTED_TITLE: Record<
  Extract<Phase, { kind: "unsupported_file" }>["code"],
  string
> = {
  not_pdf: "This file isn't a PDF.",
  too_large: "This file is larger than 10 MB.",
  damaged_pdf: "This PDF couldn't be opened.",
};

/** `label`: the trigger's wording ("Add your first record" on an empty record); the flow itself is the same. */
export default function AddRecord({
  label = "Add record",
}: {
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const submit = useCallback(async (file: File) => {
    setPhase({ kind: "processing", file });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/records/extract", { method: "POST", body });
      const data = await res
        .json()
        .catch(() => ({ status: "processing_failed", retryable: true }));
      if (data.status === "proposal") {
        setPhase({
          kind: "review",
          proposal: data.proposal,
          state: data.state,
          rejected: new Set(),
        });
      } else if (data.status === "no_changes") {
        setPhase({ kind: "no_changes" });
      } else if (data.status === "no_text") {
        setPhase({ kind: "no_text" });
      } else if (data.status === "no_supported_facts") {
        setPhase({ kind: "no_supported_facts" });
      } else if (data.status === "no_verified_facts") {
        setPhase({ kind: "no_verified_facts" });
      } else if (
        data.status === "unsupported_file" &&
        data.code in UNSUPPORTED_TITLE
      ) {
        setPhase({ kind: "unsupported_file", code: data.code });
      } else {
        setPhase({
          kind: "processing_failed",
          file,
          retryable: data.retryable !== false,
        });
      }
    } catch {
      // the request itself failed (network): nothing reached the pipeline, so retrying is reasonable
      setPhase({ kind: "processing_failed", file, retryable: true });
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
    const approved = phase.proposal.facts
      .filter((f) => !phase.rejected.has(f.id))
      .map((f) => f.id);
    if (approved.length === 0) return;
    setPhase({ ...phase, kind: "applying", applyProblem: undefined });
    let httpStatus: number | null = null;
    try {
      const res = await fetch("/api/records/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: phase.proposal.proposalId,
          approvedFactIds: approved,
        }),
      });
      httpStatus = res.status;
    } catch {
      // no response: the request may or may not have reached the server and been applied
    }
    const problem = approvalProblem(httpStatus, phase.uncertainBefore === true);
    if (problem) {
      // keep the review open with wording that claims only what is known (retry stays duplicate-safe)
      setPhase({
        ...phase,
        kind: "review",
        applyProblem: problem,
        uncertainBefore: phase.uncertainBefore || isUncertain(problem),
      });
      return;
    }
    setPhase({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, router]);

  useEffect(() => {
    if (
      phase.kind === "idle" ||
      phase.kind === "processing" ||
      phase.kind === "applying"
    )
      return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, close]);

  return (
    <>
      <button
        type="button"
        className={styles.addRecord}
        onClick={() => setPhase({ kind: "choose" })}
      >
        <PlusIcon />
        <span>{label}</span>
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
      {phase.kind !== "idle" && (
        <Panel
          phase={phase}
          setPhase={setPhase}
          onClose={close}
          onApply={applyApproved}
          onRetry={submit}
          onChoose={() => inputRef.current?.click()}
        />
      )}
    </>
  );
}

function Panel({
  phase,
  setPhase,
  onClose,
  onApply,
  onRetry,
  onChoose,
}: {
  phase: Exclude<Phase, { kind: "idle" }>;
  setPhase: (p: Phase) => void;
  onClose: () => void;
  onApply: () => void;
  onRetry: (file: File) => void;
  onChoose: () => void;
}) {
  const modalRef = useModalFocus(true);
  const busy = phase.kind === "processing" || phase.kind === "applying";
  return (
    <div className={styles.backdrop}>
      <div
        ref={modalRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-record-title"
      >
        <div className={styles.panelTop}>
          <h2 id="add-record-title" className={styles.panelTitle}>
            {phase.kind === "review" || phase.kind === "applying"
              ? "Review this record"
              : "Add record"}
          </h2>
          {!busy && (
            <button
              type="button"
              className={styles.textButton}
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
        <div className={styles.panelBody}>
          {phase.kind === "choose" && (
            <div className={styles.choose}>
              <p className={styles.chooseTitle}>
                Choose what enters your record.
              </p>
              <p>This proof of concept reads text PDFs and proposes only:</p>
              <ul>
                <li>Ferritin measurements</li>
                <li>Documented oral-iron status</li>
              </ul>
              <p className={styles.messageText}>
                You review the exact source wording and choose which facts to
                include. Scanned PDFs and other medical content are outside the
                live extraction scope.
              </p>
              <p className={styles.sectionNote}>
                Use synthetic documents only, up to 10 MB.
              </p>
              <button
                type="button"
                className={styles.primary}
                onClick={onChoose}
              >
                Choose a text PDF
              </button>
            </div>
          )}
          {phase.kind === "processing" && (
            <div className={styles.message} aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              <p className={styles.messageTitle}>Reading this record…</p>
              <p className={styles.messageText}>
                Extracted facts will be shown for your review before anything
                changes.
              </p>
            </div>
          )}
          {phase.kind === "unsupported_file" && (
            <Message
              title={UNSUPPORTED_TITLE[phase.code]}
              text="Your history hasn't changed."
            >
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Close
              </button>
            </Message>
          )}
          {phase.kind === "no_text" && (
            <Message
              title="This record doesn't contain readable text."
              text="This prototype currently works with text-based PDFs. Scanned documents would require OCR, which is outside this proof of concept."
            >
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Close
              </button>
            </Message>
          )}
          {phase.kind === "no_supported_facts" && (
            <Message
              title="No supported history changes were found in this record."
              text="This prototype currently extracts a limited set of demonstrated facts. Your history hasn't changed."
            >
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Close
              </button>
            </Message>
          )}
          {phase.kind === "no_changes" && (
            <Message
              title="No new history changes found."
              text="Your documented history hasn't changed."
            >
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Close
              </button>
            </Message>
          )}
          {phase.kind === "no_verified_facts" && (
            <Message
              title="No verified history changes were found in this record."
              text="Possible facts were found, but they couldn't be verified against the source wording. Your history hasn't changed."
            >
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Close
              </button>
            </Message>
          )}
          {phase.kind === "processing_failed" && (
            <Message
              title="We couldn't process this record."
              text="Your history hasn't changed."
            >
              {phase.retryable && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => onRetry(phase.file)}
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                {phase.retryable ? "Cancel" : "Close"}
              </button>
            </Message>
          )}
          {(phase.kind === "review" || phase.kind === "applying") && (
            <Review
              phase={phase}
              setPhase={setPhase}
              onCancel={onClose}
              onApply={onApply}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Message({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.message} aria-live="polite">
      <p className={styles.messageTitle}>{title}</p>
      <p className={styles.messageText}>{text}</p>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}

export function Review({
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
  const approvedIds = proposal.facts
    .filter((f) => !rejected.has(f.id))
    .map((f) => f.id);
  const lines = useMemo(
    () => preview(state, proposal, approvedIds),
    [state, proposal, approvedIds.join("|")],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const doc = proposal.document;
  const outcomeUncertain =
    phase.uncertainBefore === true ||
    isUncertain(phase.applyProblem) ||
    phase.applyProblem === "gone-after-uncertain";
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
        {doc.title} · {formatDate(doc.date)} · {doc.pageCount} page
        {doc.pageCount === 1 ? "" : "s"}
      </p>

      <p className={styles.pending}>
        {outcomeUncertain
          ? "The outcome of an earlier Add request is unconfirmed. Check your record."
          : phase.kind === "applying"
            ? "Adding your selected facts…"
            : phase.applyProblem === "gone"
              ? "This review is no longer available."
              : "This document has not been added yet."}
      </p>
      <h3 className={styles.sectionHeading}>Verified source facts</h3>
      <p className={styles.sectionNote}>
        Checked against source wording. Include the facts you want in your
        record.
      </p>
      <ul className={styles.facts}>
        {proposal.facts.map((f) => {
          const { label, value } = reviewFactHeadline(f, state);
          const isRejected = rejected.has(f.id);
          return (
            <li
              key={f.id}
              className={
                isRejected
                  ? `${styles.fact} ${styles.factRejected}`
                  : styles.fact
              }
            >
              <div className={styles.factHead}>
                <div>
                  <p className={styles.factLabel}>{label}</p>
                  <p className={styles.factValue}>{value}</p>
                </div>
                <label className={styles.include}>
                  <input
                    type="checkbox"
                    checked={!isRejected}
                    onChange={() => toggle(f.id)}
                    disabled={phase.kind === "applying"}
                  />
                  <span>Include this fact</span>
                </label>
              </div>
              <blockquote className={styles.excerpt}>
                {f.source.verifiedExcerpt}
              </blockquote>
              <p className={styles.excerptNote}>
                Exact wording from this record, page {f.source.page}.
              </p>
            </li>
          );
        })}
      </ul>

      {proposal.excludedCount > 0 && (
        <p className={styles.leftOut}>
          {proposal.excludedCount} extracted item
          {proposal.excludedCount === 1 ? "" : "s"} could not be verified
          against the source document and{" "}
          {proposal.excludedCount === 1 ? "was" : "were"} left out.
        </p>
      )}

      <h3 className={styles.sectionHeading}>Consequences of this selection</h3>
      {lines.length > 0 ? (
        <ul className={styles.consequences}>
          {lines.map((l) => (
            <li key={l.text}>
              <span className={styles.previewKind}>
                {l.ref.type === "claim"
                  ? "Calculated from your records"
                  : "Fact to add"}
              </span>
              {l.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.messageText}>
          {outcomeUncertain
            ? "No facts selected for this attempt. Check your record to confirm earlier requests."
            : "No facts selected. Your record will stay as it is."}
        </p>
      )}

      <div className={styles.reviewFooter}>
        {phase.applyProblem && (
          <p className={styles.applyError} role="alert">
            {APPROVAL_PROBLEM_TEXT[phase.applyProblem]}
          </p>
        )}
        <div className={styles.reviewActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={phase.kind === "applying"}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={onApply}
            disabled={
              approvedIds.length === 0 ||
              phase.kind === "applying" ||
              !canRetry(phase.applyProblem)
            }
          >
            {phase.kind === "applying"
              ? "Adding…"
              : `Add ${approvedIds.length} fact${approvedIds.length === 1 ? "" : "s"} to my record`}
          </button>
        </div>
        <p className={styles.reviewNote}>
          {approvedIds.length} of {proposal.facts.length} facts selected.
          {!outcomeUncertain &&
            phase.kind === "review" &&
            canRetry(phase.applyProblem) &&
            " Nothing changes until you add them."}
        </p>
      </div>
    </div>
  );
}
