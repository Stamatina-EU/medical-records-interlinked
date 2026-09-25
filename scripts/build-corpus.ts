/**
 * Corpus Builder Script — renders the SYNTHETIC HTML documents in corpus/src to PDF.
 * Spec: `spec.md > Corpus Builder Script`.
 *
 * Uses Playwright driving the locally installed Microsoft Edge (channel "msedge"),
 * so no browser download is needed. See `checklist.md > Revisions`.
 */
import { chromium } from "playwright";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "corpus", "src");
const seedOut = path.join(root, "data", "seed", "documents");
const demoOut = path.join(root, "demo-files");

/** The live note goes to demo-files/ (picked in the demo); everything else is seed. */
function outputFor(file: string): string {
  const base = file.replace(/\.html$/, ".pdf");
  if (base.startsWith("live-")) return path.join(demoOut, base.replace(/^live-/, ""));
  return path.join(seedOut, base);
}

async function main() {
  await mkdir(seedOut, { recursive: true });
  await mkdir(demoOut, { recursive: true });
  const files = (await readdir(srcDir)).filter((f) => f.endsWith(".html")).sort();

  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const page = await browser.newPage();
    for (const file of files) {
      await page.goto(pathToFileURL(path.join(srcDir, file)).href, { waitUntil: "load" });
      const out = outputFor(file);
      await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
      console.log(`  ${file} -> ${path.relative(root, out)}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`Built ${files.length} synthetic PDFs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
