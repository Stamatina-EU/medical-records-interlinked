/**
 * Truthful approval-failure wording (re-audit L1). The review never claims "Your record hasn't changed" unless the
 * server refused before changing anything. Each case pairs the wording with what really happened to the trusted
 * state, using the real Apply Route on a throwaway data folder.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

vi.mock("@/lib/store/paths", async () => {
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const p = await import("node:path");
  const ROOT = mkdtempSync(p.join(os.tmpdir(), "mri-approval-"));
  const SEED_DIR = p.join(ROOT, "data", "seed");
  const RUNTIME_DIR = p.join(ROOT, "data", "runtime");
  return {
    ROOT,
    SEED_DIR,
    SEED_STATE: p.join(SEED_DIR, "state.json"),
    SEED_DOCUMENTS: p.join(SEED_DIR, "documents"),
    RUNTIME_DIR,
    RUNTIME_STATE: p.join(RUNTIME_DIR, "state.json"),
    RUNTIME_DOCUMENTS: p.join(RUNTIME_DIR, "documents"),
    PENDING_DIR: p.join(RUNTIME_DIR, "pending"),
  };
});

import { ROOT, RUNTIME_DIR, SEED_DIR, SEED_STATE } from "@/lib/store/paths";
import { readState } from "@/lib/store/stateStore";
import { clearPending, saveProposal } from "@/lib/store/proposalStore";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import type { Extraction } from "@/lib/extraction/verify";
import type { Proposal } from "@/lib/model/types";
import { APPROVAL_PROBLEM_TEXT, approvalProblem, canRetry } from "@/lib/view/approvalOutcome";
import { POST as applyRoute } from "@/app/api/records/apply/route";

const repo = path.resolve(__dirname, "..");
const pdf = new Uint8Array(await readFile(path.join(repo, "demo-files/follow-up-consultation-2026-09-25.pdf")));
const extraction: Extraction = {
  document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
  labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }],
  medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
};

beforeEach(async () => {
  await mkdir(SEED_DIR, { recursive: true });
  await copyFile(path.join(repo, "data/seed/state.json"), SEED_STATE);
  await rm(RUNTIME_DIR, { recursive: true, force: true });
});
afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

async function pendingProposal(): Promise<Proposal> {
  const o = await runExtractionPipeline(pdf, await readState(), {
    extract: async () => ({ status: "ok", extraction, model: "stub" }),
    newProposalId: () => "00000000-0000-4000-8000-0000000000aa",
    now: () => "2026-10-02T10:00:00.000Z",
  });
  if (o.status !== "proposal") throw new Error(o.status);
  await saveProposal(o.proposal, pdf);
  return o.proposal;
}
const apply = async (p: Proposal, ids = p.facts.map((f) => f.id), origin = "http://127.0.0.1:3000") =>
  (await applyRoute(new Request("http://127.0.0.1:3000/api/records/apply", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ proposalId: p.proposalId, approvedFactIds: ids }),
  }))).status;
const added = async () => (await readState()).documents.filter((d) => d.origin === "added").length;
const claimsUnchanged = (text: string) => /hasn't changed|nothing was added|wasn't added/i.test(text);

describe("the wording for each outcome", () => {
  it("only a refusal before any change says the record is unchanged", () => {
    for (const status of [400, 403, 409, 503]) expect(approvalProblem(status, false)).toBe("rejected");
    expect(claimsUnchanged(APPROVAL_PROBLEM_TEXT.rejected)).toBe(true);
    for (const p of ["uncertain", "gone", "gone-after-uncertain"] as const) expect(claimsUnchanged(APPROVAL_PROBLEM_TEXT[p]), p).toBe(false);
  });

  it("no response, or an unexpected server failure, is uncertain", () => {
    for (const status of [null, 500, 502, 504]) expect(approvalProblem(status, false)).toBe("uncertain");
    expect(APPROVAL_PROBLEM_TEXT.uncertain).toBe("We couldn't confirm whether this record was added. Check your record before trying again.");
    expect(canRetry("uncertain")).toBe(true);
  });

  it("a missing review after an uncertain attempt may have been added", () => {
    expect(approvalProblem(404, true)).toBe("gone-after-uncertain");
    expect(APPROVAL_PROBLEM_TEXT["gone-after-uncertain"]).toBe(
      "This review is no longer available. The previous request may have completed. Check your record before adding it again.",
    );
    expect(approvalProblem(404, false)).toBe("gone");
    expect(canRetry("gone")).toBe(false);
    expect(canRetry("gone-after-uncertain")).toBe(false);
  });

  it("success is not a problem", () => {
    expect(approvalProblem(200, false)).toBeNull();
    expect(approvalProblem(200, true)).toBeNull();
  });
});

describe("the wording matches what really happened", () => {
  it("definite pre-commit rejection: the record really is unchanged", async () => {
    const p = await pendingProposal();
    const forged = await apply(p, [...p.facts.map((f) => f.id), "forged-fact"]);
    const foreign = await apply(p, undefined, "https://evil.example");
    expect([forged, foreign]).toEqual([400, 403]);
    for (const status of [forged, foreign]) expect(approvalProblem(status, false)).toBe("rejected");
    expect(await added()).toBe(0); // the definitive "hasn't changed" wording is true
  });

  it("lost response after a successful commit, then a retry: never claims unchanged, never adds twice", async () => {
    const p = await pendingProposal();
    // the server commits, but the browser never receives the response
    expect(await apply(p)).toBe(200);
    const shown = approvalProblem(null, false);
    expect(shown).toBe("uncertain");
    expect(await added()).toBe(1); // it WAS added — the uncertain wording is the truthful one
    expect(claimsUnchanged(APPROVAL_PROBLEM_TEXT[shown!])).toBe(false);

    // the patient retries the same review
    const retry = await apply(p);
    expect(retry).toBe(404);
    expect(approvalProblem(retry, true)).toBe("gone-after-uncertain");
    expect(await added()).toBe(1); // duplicate-safe
  });

  it("a review that disappeared for another reason (a newer upload cleared it) is 'gone', with no claim about the record", async () => {
    const p = await pendingProposal();
    await clearPending();
    const status = await apply(p);
    expect(approvalProblem(status, false)).toBe("gone");
    expect(await added()).toBe(0);
  });
});
