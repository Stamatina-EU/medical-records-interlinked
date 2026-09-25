/**
 * Seed Verifier Script — `npm run verify:seed` (also runs inside `npm test`).
 * Spec: `spec.md > Seed Verifier Script`.
 *
 * The seed is trusted state, so every hand-authored fact must pass the SAME deterministic
 * semantic checks as a live AI-proposed fact. Any failure exits non-zero.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TrustedState } from "../lib/model/types";
import { readPdfPages } from "../lib/extraction/pdfText";
import { verifySeedState } from "../lib/extraction/verify";

const root = path.resolve(__dirname, "..");

async function main() {
  const state = JSON.parse(await readFile(path.join(root, "data", "seed", "state.json"), "utf8")) as TrustedState;

  const pagesByDocId = new Map<string, string[]>();
  for (const doc of state.documents) {
    try {
      const bytes = await readFile(path.join(root, "data", "seed", "documents", doc.file));
      const pages = await readPdfPages(new Uint8Array(bytes));
      if (pages.length !== doc.pageCount) {
        console.error(`  FAIL ${doc.id}: expected ${doc.pageCount} page(s), PDF has ${pages.length}`);
        process.exitCode = 1;
      }
      pagesByDocId.set(doc.id, pages);
    } catch {
      // verifySeedState reports the missing document
    }
  }

  const failures = verifySeedState(state, pagesByDocId);
  const failed = new Set(failures.map((f) => f.factId));

  for (const doc of state.documents) {
    if (!failed.has(doc.id)) console.log(`  ok   ${doc.id}  ${doc.title} — ${doc.date}`);
  }
  for (const fact of state.facts) {
    if (!failed.has(fact.id)) console.log(`  ok   ${fact.id}  (${fact.source.documentId} p.${fact.source.page})`);
  }
  for (const f of failures) console.error(`  FAIL ${f.factId}  p.${f.page}: ${f.check}`);

  const total = state.documents.length + state.facts.length;
  if (failures.length > 0 || process.exitCode) {
    console.error(`\nverify:seed FAILED — ${failures.length} of ${total} checks did not pass.`);
    process.exit(1);
  }
  console.log(`\nverify:seed passed — ${state.facts.length} seed facts and ${state.documents.length} documents verified against their PDFs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
