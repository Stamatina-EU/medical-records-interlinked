/**
 * Identity across overlapping additions (audit H1). Two proposals are created from the SAME trusted-state version,
 * so both receive the same provisional document id. Approving both — one after the other, or at the same time —
 * must give every approved document and fact its own id, keep each PDF intact, and keep every fact resolving to
 * its own source document, page and excerpt. Runs the real apply and document routes on a throwaway data folder.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

vi.mock("@/lib/store/paths", async () => {
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const p = await import("node:path");
  const ROOT = mkdtempSync(p.join(os.tmpdir(), "mri-overlap-"));
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

import { ROOT, RUNTIME_DIR, RUNTIME_DOCUMENTS, SEED_DIR, SEED_STATE } from "@/lib/store/paths";
import { readState } from "@/lib/store/stateStore";
import { saveProposal } from "@/lib/store/proposalStore";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { readPdfPages } from "@/lib/extraction/pdfText";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import type { Extraction } from "@/lib/extraction/verify";
import type { Proposal } from "@/lib/model/types";
import { tryAcquire } from "@/lib/store/stateLock";
import { spawnSync } from "node:child_process";
import { POST as applyRoute } from "@/app/api/records/apply/route";
import { GET as documentRoute } from "@/app/api/documents/[id]/route";

const repo = path.resolve(__dirname, "..");
const pdfA = new Uint8Array(await readFile(path.join(repo, "demo-files/follow-up-consultation-2026-09-25.pdf")));
const pdfB = new Uint8Array(await readFile(path.join(repo, "tests/fixtures/second-follow-up-2026-10-02.pdf")));

const extractionA: Extraction = {
  document: { documentType: "Follow-up consultation note", documentDate: "2026-09-25", page: 1, excerpt: "Date of consultation 25 Sep 2026" },
  labMeasurements: [{ analyteName: "Ferritin", value: 32, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-09-25", page: 2, excerpt: "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)." }],
  medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "current", page: 1, excerpt: "The patient continues to take oral iron (ferrous sulfate) once daily." }],
};
const extractionB: Extraction = {
  document: { documentType: "Follow-up consultation note", documentDate: "2026-10-02", page: 1, excerpt: "Date of consultation 2 Oct 2026" },
  labMeasurements: [{ analyteName: "Ferritin", value: 41, unit: "μg/L", referenceRangeText: "15–150 μg/L", measuredOn: "2026-10-02", page: 1, excerpt: "Ferritin on 2 Oct 2026: 41 μg/L (reference range 15–150 μg/L)." }],
  medicationStatements: [{ medicationName: "oral iron (ferrous sulfate)", status: "stopped", page: 1, excerpt: "Oral iron (ferrous sulfate) was stopped on 1 Oct 2026." }],
};

beforeEach(async () => {
  await mkdir(SEED_DIR, { recursive: true });
  await copyFile(path.join(repo, "data/seed/state.json"), SEED_STATE);
  await rm(RUNTIME_DIR, { recursive: true, force: true });
});
afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

/** Both proposals are made from the same trusted-state version, before either is approved. */
async function twoOverlappingProposals(): Promise<[Proposal, Proposal]> {
  const state = await readState();
  const make = async (bytes: Uint8Array, extraction: Extraction, proposalId: string) => {
    const o = await runExtractionPipeline(bytes, state, { extract: async () => ({ status: "ok", extraction, model: "stub" }), newProposalId: () => proposalId, now: () => "2026-10-02T10:00:00.000Z" });
    if (o.status !== "proposal") throw new Error(`expected a proposal, got ${o.status}`);
    await saveProposal(o.proposal, bytes);
    return o.proposal;
  };
  const a = await make(pdfA, extractionA, "00000000-0000-4000-8000-00000000000a");
  const b = await make(pdfB, extractionB, "00000000-0000-4000-8000-00000000000b");
  return [a, b];
}

const approve = (p: Proposal) =>
  applyRoute(new Request("http://127.0.0.1:3000/api/records/apply", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000" },
    body: JSON.stringify({ proposalId: p.proposalId, approvedFactIds: p.facts.map((f) => f.id) }), // browser sends ids only
  })).then(async (r) => ({ status: r.status, body: await r.json() }));

/** Everything the audit asked for, checked on the final trusted state and the files on disk. */
async function expectBothAddedIntact() {
  const state = await readState();
  const docIds = state.documents.map((d) => d.id);
  const factIds = state.facts.map((f) => f.id);
  expect(new Set(docIds).size, "document ids are unique").toBe(docIds.length);
  expect(new Set(factIds).size, "fact ids are unique").toBe(factIds.length);

  const added = state.documents.filter((d) => d.origin === "added");
  expect(added.map((d) => d.date).sort()).toEqual(["2026-09-25", "2026-10-02"]);
  const docA = added.find((d) => d.date === "2026-09-25")!;
  const docB = added.find((d) => d.date === "2026-10-02")!;

  // each PDF is its own original bytes — neither was overwritten — and the document route serves exactly those
  for (const [doc, bytes] of [[docA, pdfA], [docB, pdfB]] as const) {
    expect(Buffer.compare(await readFile(path.join(RUNTIME_DOCUMENTS, doc.file)), Buffer.from(bytes)), doc.id).toBe(0);
    const res = await documentRoute(new Request(`http://127.0.0.1:3000/api/documents/${doc.id}`), { params: Promise.resolve({ id: doc.id }) });
    expect(res.status).toBe(200);
    expect(Buffer.compare(Buffer.from(await res.arrayBuffer()), Buffer.from(bytes)), doc.id).toBe(0);
  }

  // every new fact resolves, through the evidence index, to its own document, and its excerpt is on that page of that PDF
  const index = buildEvidenceIndex(state, derive(state));
  const expected: Record<string, [string, number[]]> = { [docA.id]: [docA.date, [32]], [docB.id]: [docB.date, [41]] };
  const newFacts = state.facts.filter((f) => f.source.documentId === docA.id || f.source.documentId === docB.id);
  expect(newFacts).toHaveLength(4);
  for (const f of newFacts) {
    const indexed = index.facts[f.id];
    const doc = index.documents[indexed.source.documentId];
    expect(doc.id).toBe(f.source.documentId);
    expect(doc.date).toBe(expected[doc.id][0]);
    if (f.kind === "lab_measurement") expect(expected[doc.id][1]).toContain(f.value);
    const pages = await readPdfPages(new Uint8Array(await readFile(path.join(RUNTIME_DOCUMENTS, doc.file))));
    expect(pages[f.source.page - 1], f.id).toContain(f.source.verifiedExcerpt);
  }
}

describe("overlapping proposals get collision-free identities at approval", () => {
  it("both proposals start with the same provisional document id (the reproduced precondition)", async () => {
    const [a, b] = await twoOverlappingProposals();
    expect(a.document.id).toBe(b.document.id);
    expect(a.facts.map((f) => f.id)).toEqual(b.facts.map((f) => f.id));
  });

  it("sequential approval: both succeed with unique ids, intact PDFs and correct evidence", async () => {
    const [a, b] = await twoOverlappingProposals();
    expect(await approve(a)).toEqual({ status: 200, body: { ok: true, status: "applied" } });
    expect(await approve(b)).toEqual({ status: 200, body: { ok: true, status: "applied" } });
    const state = await readState();
    expect(state.documents.slice(-2).map((d) => d.id)).toEqual(["doc-07", "doc-08"]);
    expect(state.latestUpdate?.documentId).toBe("doc-08");
    expect(state.latestUpdate?.approvedFactIds).toEqual(["doc-08-lab-1", "doc-08-med-1"]);
    await expectBothAddedIntact();
  });

  it("simultaneous approval: both succeed, nothing is lost and nothing collides", async () => {
    const [a, b] = await twoOverlappingProposals();
    const results = await Promise.all([approve(a), approve(b)]);
    expect(results).toEqual([
      { status: 200, body: { ok: true, status: "applied" } },
      { status: 200, body: { ok: true, status: "applied" } },
    ]);
    await expectBothAddedIntact();
  });

  it("simultaneous approval after a crashed holder left the lock behind: recovery, then one at a time", async () => {
    const [a, b] = await twoOverlappingProposals();
    const crashed = spawnSync(process.execPath, ["-e", ""]).pid!; // a process that has already exited
    expect(await tryAcquire("crashed-holder", crashed)).toBe(true);
    const results = await Promise.all([approve(a), approve(b)]);
    expect(results).toEqual([
      { status: 200, body: { ok: true, status: "applied" } },
      { status: 200, body: { ok: true, status: "applied" } },
    ]);
    await expectBothAddedIntact();
  });

  it("approving one proposal twice at the same time adds it once", async () => {
    const [a] = await twoOverlappingProposals();
    const results = await Promise.all([approve(a), approve(a)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
    const state = await readState();
    expect(state.documents.filter((d) => d.origin === "added")).toHaveLength(1);
  });
});
