/**
 * Local mutation guard (audit M3). A request from a foreign web origin must be rejected BEFORE any work: no
 * extraction, no pending-proposal cleanup or mutation, no approval. The app's own local origin keeps working.
 * Runs the real extract / cancel / apply routes on a throwaway data folder; the AI call is a spy.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Extraction } from "@/lib/extraction/verify";

vi.mock("@/lib/store/paths", async () => {
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const p = await import("node:path");
  const ROOT = mkdtempSync(p.join(os.tmpdir(), "mri-origin-"));
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

const extraction: Extraction = {
  document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
  labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }],
  medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
};
const { extractFacts } = vi.hoisted(() => ({ extractFacts: vi.fn() }));
vi.mock("@/lib/extraction/extract", () => ({
  extractFacts,
  ExtractionUnavailableError: class ExtractionUnavailableError extends Error {},
}));

import { ROOT, PENDING_DIR, RUNTIME_DIR, RUNTIME_STATE, SEED_DIR, SEED_STATE } from "@/lib/store/paths";
import { readState } from "@/lib/store/stateStore";
import { rejectForeignOrigin } from "@/lib/http/originGuard";
import { POST as extractRoute } from "@/app/api/records/extract/route";
import { POST as cancelRoute } from "@/app/api/records/cancel/route";
import { POST as applyRoute } from "@/app/api/records/apply/route";

const repo = path.resolve(__dirname, "..");
const demoPdf = await readFile(path.join(repo, "demo-files/follow-up-consultation-2026-09-25.pdf"));
const APP = "http://127.0.0.1:3000";
const FOREIGN = "https://evil.example";

beforeEach(async () => {
  await mkdir(SEED_DIR, { recursive: true });
  await copyFile(path.join(repo, "data/seed/state.json"), SEED_STATE);
  await rm(RUNTIME_DIR, { recursive: true, force: true });
  extractFacts.mockReset();
  extractFacts.mockResolvedValue({ status: "ok", extraction, model: "stub" });
});
afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

const req = (route: string, origin: string | null, body: BodyInit, headers: Record<string, string> = {}) =>
  new Request(`${APP}/api/records/${route}`, { method: "POST", body, headers: { ...(origin ? { origin } : {}), ...headers } });
const extract = (origin: string | null) => {
  const fd = new FormData();
  fd.append("file", new File([demoPdf], "note.pdf", { type: "application/pdf" }));
  return extractRoute(req("extract", origin, fd));
};
const json = (o: unknown) => ({ body: JSON.stringify(o), headers: { "content-type": "application/json" } });
const stateHash = async () => createHash("sha256").update(await readFile(RUNTIME_STATE)).digest("hex");
const pending = async () => readdir(PENDING_DIR).catch(() => [] as string[]);

/** A real pending proposal, created through the app's own origin. */
async function pendingProposal() {
  const res = await extract(APP);
  const body = await res.json();
  expect(body.status).toBe("proposal");
  return body.proposal as { proposalId: string; facts: { id: string }[] };
}

describe("the guard itself", () => {
  const check = (origin: string | null, url = `${APP}/api/records/apply`, headers: Record<string, string> = {}) =>
    rejectForeignOrigin(new Request(url, { method: "POST", headers: { ...(origin ? { origin } : {}), ...headers } }))?.status ?? "allowed";

  it("allows the app's own local origin, its loopback aliases, and requests with no Origin", () => {
    expect(check(APP)).toBe("allowed");
    expect(check("http://localhost:3000")).toBe("allowed");
    expect(check(null)).toBe("allowed");
    expect(check(APP, undefined, { "sec-fetch-site": "same-origin" })).toBe("allowed");
  });

  it("rejects foreign sites, other local ports, opaque origins and cross-site fetches", () => {
    expect(check(FOREIGN)).toBe(403);
    expect(check("http://localhost:8080")).toBe(403);
    expect(check("null")).toBe(403);
    expect(check("http://127.0.0.1:3000.evil.example")).toBe(403);
    expect(check(null, undefined, { "sec-fetch-site": "cross-site" })).toBe(403);
    expect(check(null, undefined, { "sec-fetch-site": "same-site" })).toBe(403);
  });
});

describe("routes reject a foreign origin before any work", () => {
  it("extract: no AI call, no cleanup of the existing pending proposal", async () => {
    const existing = await pendingProposal();
    extractFacts.mockClear();
    const res = await extract(FOREIGN);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "forbidden" });
    expect(extractFacts).not.toHaveBeenCalled();
    expect(await pending()).toEqual([existing.proposalId]);
  });

  it("cancel: the pending proposal survives", async () => {
    const p = await pendingProposal();
    const res = await cancelRoute(req("cancel", FOREIGN, json({ proposalId: p.proposalId }).body, json({}).headers));
    expect(res.status).toBe(403);
    expect(await pending()).toEqual([p.proposalId]);
  });

  it("apply: trusted state and the pending proposal are unchanged", async () => {
    const p = await pendingProposal();
    await readState(); // make sure the runtime state exists before hashing it
    const before = await stateHash();
    const body = json({ proposalId: p.proposalId, approvedFactIds: p.facts.map((f) => f.id) });
    const res = await applyRoute(req("apply", FOREIGN, body.body, body.headers));
    expect(res.status).toBe(403);
    expect(await stateHash()).toBe(before);
    expect(await pending()).toEqual([p.proposalId]);
  });
});

describe("the app's own origin keeps working", () => {
  it("extract → apply succeeds", async () => {
    const p = await pendingProposal();
    expect(extractFacts).toHaveBeenCalledTimes(1);
    const body = json({ proposalId: p.proposalId, approvedFactIds: p.facts.map((f) => f.id) });
    const res = await applyRoute(req("apply", APP, body.body, { ...body.headers, "sec-fetch-site": "same-origin" }));
    expect(await res.json()).toEqual({ ok: true, status: "applied" });
    expect((await readState()).documents).toHaveLength(7);
  });

  it("cancel from the app's origin deletes the pending proposal", async () => {
    const p = await pendingProposal();
    const res = await cancelRoute(req("cancel", APP, json({ proposalId: p.proposalId }).body, json({}).headers));
    expect(res.status).toBe(200);
    expect(await pending()).toEqual([]);
  });
});
