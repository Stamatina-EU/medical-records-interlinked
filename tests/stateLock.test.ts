/**
 * Trusted-state lock under adversarial interleavings (re-audit H1). The lock is ownership-aware: stale means the
 * owner's process is gone; take-over deletes only the exact owner observed dead; release deletes only the caller's
 * own lock. A live holder never loses the lock to elapsed time. Runs on a throwaway data folder.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { readdir, rm, utimes } from "node:fs/promises";
import path from "node:path";

vi.mock("@/lib/store/paths", async () => {
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const p = await import("node:path");
  const ROOT = mkdtempSync(p.join(os.tmpdir(), "mri-lock-"));
  const RUNTIME_DIR = p.join(ROOT, "data", "runtime");
  return { ROOT, RUNTIME_DIR, RUNTIME_STATE: p.join(RUNTIME_DIR, "state.json") };
});

import { ROOT, RUNTIME_DIR } from "@/lib/store/paths";
import { StateBusyError, lockOwner, processAlive, reapIfStale, release, tryAcquire, withStateLock } from "@/lib/store/stateLock";

const LOCK = () => path.join(RUNTIME_DIR, ".state.lock");
/** The pid of a real process that has already exited. */
function deadPid(): number {
  const r = spawnSync(process.execPath, ["-e", ""]);
  expect(processAlive(r.pid!)).toBe(false);
  return r.pid!;
}
const owner = async () => {
  const o = await lockOwner();
  return o && o !== "none" ? o.token : o;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const longAgo = new Date(Date.now() - 24 * 3600 * 1000);

beforeEach(async () => {
  await rm(RUNTIME_DIR, { recursive: true, force: true });
});
afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

describe("stale take-over never deletes a newer lock", () => {
  it("1+2 · two waiters observe the same stale lock; one takes over, the other's late action does nothing", async () => {
    const dead = deadPid();
    expect(await tryAcquire("crashed", dead)).toBe(true);
    const seenByA = await lockOwner();
    const seenByB = await lockOwner(); // both waiters observe the same stale owner
    expect(seenByA).toEqual({ token: "crashed", pid: dead });
    expect(seenByB).toEqual(seenByA);

    // A takes over and acquires a fresh lock BEFORE B acts on its (now stale) observation
    expect(await reapIfStale("crashed", dead)).toBe(true);
    expect(await tryAcquire("A")).toBe(true);
    // B acts late: it can neither delete A's fresh lock nor acquire
    expect(await reapIfStale("crashed", dead)).toBe(false);
    expect(await tryAcquire("B")).toBe(false);
    expect(await owner()).toBe("A");
    expect(await release("A")).toBe(true);
    expect(await owner()).toBeNull();
  });

  it("many concurrent waiters on a stale lock: exactly one inside at a time, and all make progress", async () => {
    expect(await tryAcquire("crashed", deadPid())).toBe(true);
    let inside = 0;
    let maxInside = 0;
    const done: number[] = [];
    await Promise.all(Array.from({ length: 12 }, (_, i) => withStateLock(async () => {
      inside++;
      maxInside = Math.max(maxInside, inside);
      await sleep(5);
      inside--;
      done.push(i);
    })));
    expect(maxInside).toBe(1);
    expect(done).toHaveLength(12);
    expect(await owner()).toBeNull();
  });
});

describe("a live holder keeps the lock", () => {
  it("3 · crossing any age threshold does not make a live holder's lock stale", async () => {
    let releaseHolder!: () => void;
    const holding = new Promise<void>((r) => (releaseHolder = r));
    let entered = false;
    const holder = withStateLock(async () => {
      entered = true;
      await holding;
    });
    while (!entered) await sleep(5);
    const holderToken = await owner();
    // make the lock look a day old
    await utimes(LOCK(), longAgo, longAgo);
    for (const f of await readdir(LOCK())) await utimes(path.join(LOCK(), f), longAgo, longAgo);

    let secondRan = false;
    await expect(withStateLock(async () => void (secondRan = true), 300)).rejects.toBeInstanceOf(StateBusyError);
    expect(secondRan).toBe(false);
    expect(await reapIfStale(holderToken as string, process.pid)).toBe(false);
    expect(await owner()).toBe(holderToken);

    releaseHolder();
    await holder;
    expect(await owner()).toBeNull();
  });
});

describe("only the owner can release", () => {
  it("4 · a former owner, or a non-owner, cannot release the current holder's lock", async () => {
    expect(await tryAcquire("A")).toBe(true);
    expect(await release("B")).toBe(false); // never owned it
    expect(await owner()).toBe("A");
    expect(await release("A")).toBe(true);
    expect(await tryAcquire("C")).toBe(true);
    expect(await release("A")).toBe(false); // A no longer owns the lock
    expect(await owner()).toBe("C");
    expect(await release("C")).toBe(true);
  });

  it("success and failure paths release only the lock they own", async () => {
    await withStateLock(async () => undefined);
    await expect(withStateLock(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await owner()).toBeNull();
  });
});

describe("crash recovery", () => {
  it("6 · a process that dies holding the lock does not block future progress", async () => {
    // a real separate process takes the lock with the same on-disk layout, then exits without releasing it
    const script = `
      const fs = require("fs"), path = require("path");
      const dir = process.argv[1], tmp = dir + ".tmp-crashed-child";
      fs.mkdirSync(tmp, { recursive: true });
      fs.writeFileSync(path.join(tmp, "crashed-child"), JSON.stringify({ pid: process.pid }));
      fs.renameSync(tmp, dir);
      process.exit(1);`;
    const child = spawnSync(process.execPath, ["-e", script, LOCK()]);
    expect(child.status).toBe(1);
    expect(await lockOwner()).toEqual({ token: "crashed-child", pid: child.pid });

    let ran = false;
    await withStateLock(async () => void (ran = true));
    expect(ran).toBe(true);
    expect(await owner()).toBeNull();
  });
});
