/**
 * Trusted-state lock — SERVER ONLY. One approval at a time, in this server or in another process on this machine
 * using the same data folder. Ownership-aware; no wall-clock expiry.
 *
 * Layout: the lock is the directory `data/runtime/.state.lock`, holding exactly one file named after its owner's
 * random token; the file records the owner's process id.
 *  - Acquire: build `.state.lock.tmp-<token>/<token>` privately, then rename it to `.state.lock`. The rename is atomic
 *    and fails while a lock exists, so a lock is never visible without its owner file.
 *  - Stale = the owner's PROCESS IS GONE (crash). A live holder never loses the lock, however long it holds it.
 *  - Take-over of a stale lock deletes only the owner file with the exact token observed dead. If that lock was
 *    already replaced, the file is gone and nothing happens: a newer lock (another token) can never be deleted.
 *    The directory is then removed only if empty, i.e. owned by nobody.
 *  - Release deletes only the caller's own owner file, then the directory only if empty.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { RUNTIME_DIR } from "@/lib/store/paths";

export class StateBusyError extends Error {}

const LOCK_WAIT_MS = 10_000;
const lockDir = () => path.join(RUNTIME_DIR, ".state.lock");
const code = (err: unknown) => (err as NodeJS.ErrnoException).code;

/** Is the process alive? EPERM means it exists but belongs to someone else — alive. */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return code(err) === "EPERM";
  }
}

/** Try once to take the lock as `token` (owned by `pid`). Never waits, never removes anything but its own temp dir. */
export async function tryAcquire(token: string, pid: number = process.pid): Promise<boolean> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tmp = `${lockDir()}.tmp-${token}`;
  await mkdir(tmp, { recursive: true });
  await writeFile(path.join(tmp, token), JSON.stringify({ pid }), "utf8");
  try {
    await rename(tmp, lockDir());
    return true;
  } catch {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    return false;
  }
}

/** The current holder: `null` when there is no lock, `"none"` when the lock directory is empty (owned by nobody). */
export async function lockOwner(): Promise<{ token: string; pid: number } | "none" | null> {
  let entries: string[];
  try {
    entries = await readdir(lockDir());
  } catch (err) {
    if (code(err) === "ENOENT") return null;
    throw err;
  }
  if (entries.length === 0) return "none";
  const token = entries[0];
  try {
    const { pid } = JSON.parse(await readFile(path.join(lockDir(), token), "utf8"));
    return { token, pid: Number(pid) };
  } catch {
    return { token, pid: process.pid }; // unreadable just now: treat as alive and wait
  }
}

/** Remove the lock directory only if it is empty (owned by nobody). */
async function removeIfEmpty(): Promise<void> {
  await rmdir(lockDir()).catch(() => undefined); // fails harmlessly if it holds an owner file or is already gone
}

/**
 * Take over the lock observed as owned by `token`, only if that owner's process is gone. Deletes that exact owner
 * file — never a newer lock — and returns whether it did.
 */
export async function reapIfStale(token: string, pid: number): Promise<boolean> {
  if (processAlive(pid)) return false;
  try {
    await unlink(path.join(lockDir(), token));
  } catch {
    return false; // already released or reaped: the lock now belongs to someone else, or to nobody
  }
  await removeIfEmpty();
  return true;
}

/** Release the lock held as `token`. A caller that does not own the lock changes nothing. */
export async function release(token: string): Promise<boolean> {
  try {
    await unlink(path.join(lockDir(), token));
  } catch {
    return false;
  }
  await removeIfEmpty();
  return true;
}

/** Run `fn` while holding the trusted-state lock. */
export async function withStateLock<T>(fn: () => Promise<T>, waitMs: number = LOCK_WAIT_MS): Promise<T> {
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  while (!(await tryAcquire(token))) {
    const owner = await lockOwner();
    if (owner === "none") await removeIfEmpty();
    else if (owner && (await reapIfStale(owner.token, owner.pid))) continue;
    if (Date.now() > deadline) throw new StateBusyError("the record is busy");
    await new Promise((r) => setTimeout(r, 15));
  }
  try {
    return await fn();
  } finally {
    await release(token);
  }
}
