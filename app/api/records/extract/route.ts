/**
 * Extract Route — POST multipart/form-data { file: PDF }. Spec: `spec.md > Extract Route`.
 *
 * Runs the extraction pipeline (lib/extraction/pipeline.ts) and saves a pending proposal.
 * The trusted state is NEVER touched here. Responses carry the pipeline's outcome status and
 * reason code only — never document text:
 *   proposal | no_changes | unsupported_file | no_text | no_supported_facts | no_verified_facts (200)
 *   processing_failed (502 when the AI service was unreachable, otherwise 200)
 */
import { NextResponse } from "next/server";
import { readState } from "@/lib/store/stateStore";
import { extractFacts } from "@/lib/extraction/extract";
import { outcomeLogLine, runExtractionPipeline } from "@/lib/extraction/pipeline";
import { clearPending, newProposalId, saveProposal } from "@/lib/store/proposalStore";
import { rejectForeignOrigin } from "@/lib/http/originGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign; // before reading the upload or touching pending proposals

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ status: "unsupported_file", code: "not_pdf" }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ status: "unsupported_file", code: "not_pdf" }, { status: 400 });

  await clearPending(); // orphaned proposals (e.g. after a refresh mid-review) are discarded

  const bytes = new Uint8Array(await file.arrayBuffer());
  const state = await readState();
  const outcome = await runExtractionPipeline(bytes, state, {
    extract: extractFacts,
    newProposalId,
    now: () => new Date().toISOString(),
  });
  console.info(outcomeLogLine(outcome)); // status + reason code only

  if (outcome.status === "proposal") {
    await saveProposal(outcome.proposal, bytes);
    // The current trusted state goes back so the browser can rerun the pure preview as facts are rejected.
    return NextResponse.json({ status: "proposal", proposal: outcome.proposal, state });
  }
  const httpStatus = outcome.status === "processing_failed" && outcome.code === "ai_unavailable" ? 502 : 200;
  return NextResponse.json(outcome, { status: httpStatus });
}
