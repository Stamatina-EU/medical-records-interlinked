/**
 * Extraction Client — SERVER ONLY. The AI's one job: propose facts in a closed schema.
 * Spec: `spec.md > Extraction Client`, `spec.md > External Services and Dependencies`.
 *
 * Provider: OpenAI Responses API with strict JSON-schema Structured Outputs
 * (`client.responses.parse` + `zodTextFormat`). Its output is never shown to the patient and
 * never written to trusted state; it goes straight to the deterministic Fact Verifier.
 * Model and reasoning effort come from server-side env (EXTRACTION_MODEL, EXTRACTION_EFFORT);
 * changing them never changes the schema or pipeline.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ExtractionSchema } from "@/lib/extraction/schema";
import { EXTRACTION_SYSTEM_PROMPT, buildUserContent } from "@/lib/extraction/prompt";
import type { Extraction } from "@/lib/extraction/verify";

type Effort = "none" | "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["none", "low", "medium", "high", "xhigh", "max"];

export function extractionConfig(): { model: string; effort: Effort } {
  const model = process.env.EXTRACTION_MODEL?.trim() || "gpt-6-luna";
  const e = process.env.EXTRACTION_EFFORT?.trim() as Effort | undefined;
  const effort: Effort = e && EFFORTS.includes(e) ? e : "low";
  return { model, effort };
}

/** The call could not be completed (network, auth, rate limit, server error): the UI offers "Try again". */
export class ExtractionUnavailableError extends Error {}

/** `code` is fixed and content-free; `reason` is a short developer note that never quotes the document or model output. */
export type ExtractionCallResult =
  | { status: "ok"; extraction: Extraction; model: string }
  | { status: "unusable"; code: "refused" | "incomplete" | "invalid_output"; reason: string; model: string };

export async function extractFacts(pages: string[]): Promise<ExtractionCallResult> {
  const { model, effort } = extractionConfig();

  let client: OpenAI;
  try {
    client = new OpenAI({ timeout: 60_000, maxRetries: 2 }); // reads OPENAI_API_KEY
  } catch (err) {
    throw new ExtractionUnavailableError(`OpenAI client could not start (${(err as Error).name})`);
  }

  try {
    const response = await client.responses.parse({
      model,
      instructions: EXTRACTION_SYSTEM_PROMPT,
      input: buildUserContent(pages),
      text: { format: zodTextFormat(ExtractionSchema, "extraction") },
      reasoning: { effort },
      max_output_tokens: 16000,
    });
    const used = response.model ?? model;

    const refused = response.output.some(
      (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
    );
    if (refused) return { status: "unusable", code: "refused", reason: "the model declined to process this document", model: used };
    if (response.status === "incomplete") {
      const why = response.incomplete_details?.reason ?? "unknown reason";
      return { status: "unusable", code: "incomplete", reason: `the model's answer was incomplete (${why})`, model: used };
    }
    if (!response.output_parsed) {
      return { status: "unusable", code: "invalid_output", reason: "the model's answer did not match the schema", model: used };
    }
    return { status: "ok", extraction: response.output_parsed, model: used };
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      // Covers connection errors, timeouts, auth, rate limits and 5xx — all retryable from the user's view.
      // Only the error class and HTTP status: provider messages can echo request details.
      throw new ExtractionUnavailableError(`${err.constructor.name}${err.status ? ` (HTTP ${err.status})` : ""}`);
    }
    // Anything else (e.g. output that failed schema parsing) means the answer cannot be used.
    // The parser's message can quote model output, so it is not kept.
    return { status: "unusable", code: "invalid_output", reason: `the model's answer could not be parsed (${(err as Error).name})`, model };
  }
}
