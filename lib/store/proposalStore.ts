/**
 * Proposal Store — SERVER ONLY. Spec: `spec.md > Proposal Store`.
 * Pending proposals live in data/runtime/pending/{proposalId}/ (proposal.json + source.pdf).
 * Created by extract, read by apply, deleted by apply / cancel / the next extract / demo reset.
 * Never read by any page, so an unapproved proposal cannot influence what is displayed.
 */
import { mkdir, readFile, rm, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Proposal } from "@/lib/model/types";
import { PENDING_DIR, RUNTIME_DOCUMENTS } from "@/lib/store/paths";

const ID = /^[a-f0-9-]{36}$/;

export function newProposalId(): string {
  return randomUUID();
}

function dirFor(proposalId: string): string {
  if (!ID.test(proposalId)) throw new Error("invalid proposal id");
  return path.join(PENDING_DIR, proposalId);
}

export async function clearPending(): Promise<void> {
  try {
    for (const entry of await readdir(PENDING_DIR)) await rm(path.join(PENDING_DIR, entry), { recursive: true, force: true });
  } catch {
    // nothing pending
  }
}

export async function saveProposal(proposal: Proposal, pdf: Uint8Array): Promise<void> {
  const dir = dirFor(proposal.proposalId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "source.pdf"), pdf);
  await writeFile(path.join(dir, "proposal.json"), JSON.stringify(proposal, null, 2), "utf8");
}

export async function loadProposal(proposalId: string): Promise<Proposal | null> {
  try {
    return JSON.parse(await readFile(path.join(dirFor(proposalId), "proposal.json"), "utf8")) as Proposal;
  } catch {
    return null;
  }
}

/** Move the proposal's PDF into the runtime documents folder (only on Apply). */
export async function commitProposalDocument(proposal: Proposal): Promise<void> {
  await mkdir(RUNTIME_DOCUMENTS, { recursive: true });
  await copyFile(path.join(dirFor(proposal.proposalId), "source.pdf"), path.join(RUNTIME_DOCUMENTS, path.basename(proposal.document.file)));
}

export async function deleteProposal(proposalId: string): Promise<void> {
  try {
    await rm(dirFor(proposalId), { recursive: true, force: true });
  } catch {
    // invalid id or already gone — idempotent
  }
}
