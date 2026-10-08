/**
 * Runtime-state initialisation — a fresh clone has no data/runtime/state.json, and the first page load reads
 * state from several places at once (layout + page). Those concurrent first reads must produce exactly one valid
 * runtime state, equal to the seed, with no partial file ever observable and no error (EBUSY / corrupted state).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Point the store at a throwaway root so the test never touches the real data/ folder.
vi.mock("@/lib/store/paths", async () => {
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const p = await import("node:path");
  const ROOT = mkdtempSync(p.join(os.tmpdir(), "mri-state-"));
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

import { ROOT, RUNTIME_DIR, RUNTIME_STATE, SEED_DIR, SEED_STATE } from "@/lib/store/paths";
import { readState } from "@/lib/store/stateStore";

const realSeed = path.resolve(__dirname, "../data/seed/state.json");

beforeEach(async () => {
  await mkdir(SEED_DIR, { recursive: true });
  await copyFile(realSeed, SEED_STATE);
  await rm(RUNTIME_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

/** Reads the runtime file directly, as fast as possible, until stopped; any content it sees must be the whole seed. */
function watchForPartialFile(seedText: string) {
  const seen: string[] = [];
  let stop = false;
  const done = (async () => {
    while (!stop) {
      try {
        const text = await readFile(RUNTIME_STATE, "utf8");
        if (text !== seedText) seen.push(`observed ${text.length} bytes, not the seed`);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") seen.push(`read failed: ${code}`);
      }
    }
  })();
  return { stopAndReport: async () => ((stop = true), await done, seen) };
}

describe("runtime state initialisation", () => {
  it("concurrent first reads create one valid runtime state that matches the seed", async () => {
    const seedText = await readFile(SEED_STATE, "utf8");
    const seed = JSON.parse(seedText);
    for (let round = 0; round < 10; round++) {
      await rm(RUNTIME_DIR, { recursive: true, force: true });
      const watcher = watchForPartialFile(seedText);
      const results = await Promise.allSettled(Array.from({ length: 24 }, () => readState()));
      const partial = await watcher.stopAndReport();

      const failures = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
      expect(failures, `round ${round}`).toEqual([]);
      for (const r of results) expect((r as PromiseFulfilledResult<unknown>).value).toEqual(seed);
      expect(await readFile(RUNTIME_STATE, "utf8")).toBe(seedText);
      expect(await readdir(RUNTIME_DIR), "no temp files left behind").toEqual(["state.json"]);
      expect(partial, "a partial runtime file was observable").toEqual([]);
    }
  });

  it("initialisation never overwrites a runtime state that already exists", async () => {
    const seed = JSON.parse(await readFile(SEED_STATE, "utf8"));
    const changed = { ...seed, patient: { displayName: "Changed after an approval (synthetic)" } };
    await mkdir(RUNTIME_DIR, { recursive: true });
    await writeFile(RUNTIME_STATE, JSON.stringify(changed, null, 2) + "\n", "utf8");
    const results = await Promise.all(Array.from({ length: 12 }, () => readState()));
    for (const r of results) expect(r.patient.displayName).toBe("Changed after an approval (synthetic)");
  });
});
