/**
 * Preflight Script — `npm run preflight [runs]` (default 5). Spec: `spec.md > Preflight Script`.
 *
 * Runs the REAL pipeline on the live demo note N times:
 *   PDF text -> OpenAI Responses API (EXTRACTION_MODEL) -> schema -> Fact Verifier -> dedupe vs the SEED state
 * A run passes only if BOTH expected facts are verified: ferritin 32 μg/L (range 15–150, page 2)
 * and oral iron Current, shown as "Ongoing" (page 1). Never writes runtime state. Costs well under a cent per run on the default model.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoProfile } from "../lib/demo/profile";
import { readBaseline,emptyOverlay,composeRecord } from "../lib/demo/store";
import { liveContext,dedupeLive } from "../lib/demo/record";
import type { TrustedState } from "../lib/model/types";
import { readPdfPages } from "../lib/extraction/pdfText";
import { verifyExtraction } from "../lib/extraction/verify";
import { dedupe } from "../lib/engine/dedupe";
import { ExtractionUnavailableError, extractFacts, extractionConfig } from "../lib/extraction/extract";

const root = path.resolve(__dirname, "..");
const NOTE = path.join(root, "demo-files", "follow-up-consultation-2026-09-25.pdf");

function loadEnv() {
  try {
    process.loadEnvFile(path.join(root, ".env.local"));
  } catch {
    // no .env.local — the missing key is reported below
  }
}

async function main() {
  loadEnv();
  const runs = Math.max(1, Number(process.argv[2] ?? 5) || 5);
  const { model, effort } = extractionConfig();
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Add it to .env.local (see .env.example) and run again.");
    process.exit(1);
  }

  const profile=demoProfile();
  const rich=profile==="rich" ? await readBaseline() : null;
  const seed=rich ? liveContext(composeRecord(rich.baseline,emptyOverlay(rich.digest))) : JSON.parse(await readFile(path.join(root,"data","seed","state.json"),"utf8")) as TrustedState;
  const pages = await readPdfPages(new Uint8Array(await readFile(NOTE)));
  console.log(`Preflight (${profile} baseline): ${runs} run(s) · model ${model} · effort ${effort} · ${pages.length} page(s)\n`);

  let passed = 0;
  for (let i = 1; i <= runs; i++) {
    const t0 = Date.now();
    let line = `Run ${i}: `;
    try {
      const call = await extractFacts(pages);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (call.status === "unusable") {
        console.log(`${line}FAIL (${secs}s, ${call.model}) — unusable: ${call.reason}\n`);
        continue;
      }
      const outcome = verifyExtraction(pages, call.extraction, { documentId: "preflight", episodes: seed.episodes });
      if (outcome.status === "unusable") {
        console.log(`${line}FAIL (${secs}s, ${call.model}) — unusable after verification: ${outcome.reason}\n`);
        continue;
      }
      const { fresh, duplicates } = (profile==="rich" ? dedupeLive : dedupe)(seed.facts, outcome.verified);

      const lab = fresh.find(
        (f) =>
          f.kind === "lab_measurement" && f.value === 32 && f.refLow === 15 && f.refHigh === 150 && f.source.page === 2 && f.measuredOn === "2026-09-25",
      );
      const med = fresh.find(
        (f) => f.kind === "medication_status" && f.episodeId === "ep-oral-iron" && f.status === "Current" && f.source.page === 1,
      );
      const ok = Boolean(lab && med);
      if (ok) passed++;

      const proposedCount = call.extraction.labMeasurements.length + call.extraction.medicationStatements.length;
      line += `${ok ? "PASS" : "FAIL"} (${secs}s, ${call.model}) — model proposed ${proposedCount}, verified ${outcome.verified.length}, excluded ${outcome.excludedCount}, duplicates ${duplicates.length}`;
      console.log(line);
      for (const f of fresh) {
        const what =
          f.kind === "lab_measurement"
            ? `ferritin ${f.value} ${f.unit} (range ${f.refText ?? "—"}) on ${f.measuredOn}`
            : `oral iron → ${f.status} (documented ${f.documentedOn})`;
        console.log(`   ✓ ${what} · p.${f.source.page} · "${f.source.verifiedExcerpt}"`);
      }
      for (const x of outcome.exclusions) console.log(`   ✗ excluded ${x.kind}: ${x.reason}`);
      console.log("");
    } catch (err) {
      const kind = err instanceof ExtractionUnavailableError ? "API unavailable" : "error";
      console.log(`${line}FAIL — ${kind}: ${(err as Error).message}\n`);
    }
  }

  console.log(`Preflight ${passed === runs ? "PASSED" : "FAILED"}: ${passed}/${runs} runs verified both expected facts.`);
  // Let the process end naturally: process.exit() while HTTP sockets are closing trips a libuv assertion on Windows.
  process.exitCode = passed === runs ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
