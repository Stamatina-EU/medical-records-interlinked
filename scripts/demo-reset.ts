/**
 * Demo Reset Script — `npm run demo:reset`. Spec: `spec.md > Demo Reset Script`.
 * Terminal-only by design: there is no in-app control, so it can never appear on camera.
 * Deletes data/runtime/ (approved changes, added documents, pending proposals) and copies the
 * committed seed state back. Then refresh the browser.
 */
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const runtime = path.join(root, "data", "runtime");

async function main() {
  await rm(runtime, { recursive: true, force: true });
  await mkdir(runtime, { recursive: true });
  await copyFile(path.join(root, "data", "seed", "state.json"), path.join(runtime, "state.json"));
  console.log("Demo reset: runtime history restored from the seed. Refresh the browser.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
