/**
 * What the review panel can TRUTHFULLY say after an Add attempt that did not clearly succeed. It never claims the
 * record is unchanged unless the server refused before changing anything — AND no earlier attempt is unaccounted for.
 *  - "rejected": the Apply Route refused before any change — invalid request (400), foreign origin (403),
 *    identity conflict (409), record busy (503). Each of these returns before the trusted state is written.
 *  - "uncertain": no reliable answer — the request or its response was lost, or the server failed in a way that
 *    may have happened after the record was written.
 *  - "still-uncertain": a later attempt also did not settle it. Once an attempt is uncertain, a later refusal only
 *    says that THIS attempt changed nothing; the earlier one may still have added the record, so the uncertainty
 *    is sticky until the client positively learns the outcome (a success, or a missing review).
 *  - "gone": the server no longer has this review (404).
 *  - "gone-after-uncertain": the same, after an uncertain attempt — that attempt may have added the record.
 */
export type ApprovalProblem = "rejected" | "uncertain" | "still-uncertain" | "gone" | "gone-after-uncertain";

const REFUSED_BEFORE_ANY_CHANGE = new Set([400, 403, 409, 503]);

/** `httpStatus`: the response status, or `null` when no response arrived. `null` result = success. */
export function approvalProblem(httpStatus: number | null, previouslyUncertain: boolean): ApprovalProblem | null {
  if (httpStatus !== null && httpStatus >= 200 && httpStatus < 300) return null;
  if (httpStatus === 404) return previouslyUncertain ? "gone-after-uncertain" : "gone";
  if (previouslyUncertain) return "still-uncertain";
  if (httpStatus !== null && REFUSED_BEFORE_ANY_CHANGE.has(httpStatus)) return "rejected";
  return "uncertain";
}

export const APPROVAL_PROBLEM_TEXT: Record<ApprovalProblem, string> = {
  rejected: "This record wasn't added. Your record hasn't changed. You can try again.",
  uncertain: "We couldn't confirm whether this record was added. Check your record before trying again.",
  "still-uncertain": "We still couldn't confirm whether this record was added. Check your record before trying again.",
  gone: "This review is no longer available. Close it and add the record again.",
  "gone-after-uncertain": "This review is no longer available. The previous request may have completed. Check your record before adding it again.",
};

/** An outcome that leaves an earlier attempt unaccounted for: every later failure stays uncertain. */
export const isUncertain = (p: ApprovalProblem | undefined) => p === "uncertain" || p === "still-uncertain";

/** Retrying makes sense only while the server still has the review (it re-checks everything, so retry is duplicate-safe). */
export const canRetry = (p: ApprovalProblem | undefined) => p !== "gone" && p !== "gone-after-uncertain";
