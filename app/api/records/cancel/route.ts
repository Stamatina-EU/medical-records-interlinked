/** Cancel Route — POST { proposalId }. Deletes the pending proposal; idempotent; imports nothing. */
import { NextResponse } from "next/server";
import { deleteProposal } from "@/lib/store/proposalStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { proposalId } = await req.json();
    if (typeof proposalId === "string") await deleteProposal(proposalId);
  } catch {
    // nothing to cancel
  }
  return NextResponse.json({ ok: true });
}
