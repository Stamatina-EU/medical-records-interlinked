/**
 * State Store — SERVER ONLY. Spec: `spec.md > State Store`.
 * Reads data/runtime/state.json, initialising it from the committed seed if missing.
 * Writes atomically (temp file + rename). A corrupted runtime file is reported, never silently
 * overwritten — the fix is `npm run demo:reset`.
 */
import { randomUUID } from "node:crypto";
import { access, copyFile, link, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TrustedState } from "@/lib/model/types";
import { RUNTIME_DIR, RUNTIME_STATE, SEED_STATE } from "@/lib/store/paths";

export class StateCorruptedError extends Error {}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates the runtime state from the seed, safely under concurrency: a fresh clone's first page load reads
 * state from several places at once. Each caller copies the seed to its own temp file, then publishes it with a
 * hard link, which atomically creates state.json only if it does not exist yet. The first link wins; the others
 * get EEXIST and simply read the winner's file. Readers therefore see either no file or the complete seed, and an
 * existing runtime state is never overwritten.
 */
async function initRuntimeState(): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tmp = `${RUNTIME_STATE}.${randomUUID()}.init.tmp`;
  await copyFile(SEED_STATE, tmp);
  try {
    await link(tmp, RUNTIME_STATE);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return; // another reader initialised it first
    // A filesystem without hard links: fall back to an atomic rename, if no one has initialised it meanwhile.
    if ((code === "EPERM" || code === "ENOTSUP" || code === "ENOSYS") && !(await exists(RUNTIME_STATE))) {
      await rename(tmp, RUNTIME_STATE);
      return;
    }
    if (!(await exists(RUNTIME_STATE))) throw err;
  } finally {
    // cleanup must never turn a successful initialisation into an error
    await rm(tmp, { force: true }).catch(() => undefined);
  }
}

export async function readState(): Promise<TrustedState> {
  if (!(await exists(RUNTIME_STATE))) await initRuntimeState();
  const raw = await readFile(RUNTIME_STATE, "utf8");
  try {
    const state = JSON.parse(raw) as TrustedState;
    if (state.version !== 1 || !Array.isArray(state.facts) || !Array.isArray(state.documents)) {
      throw new Error("unexpected shape");
    }
    return state;
  } catch (err) {
    throw new StateCorruptedError(`data/runtime/state.json is not valid (${(err as Error).message})`);
  }
}

export class StateBusyError extends Error {}

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 10_000;

/**
 * Runs `fn` while holding the trusted-state lock, so a read–modify–write (an approval) can never interleave with
 * another one — in this server or in another process using the same data folder. The lock is a directory:
 * creating it is atomic and fails if it exists. A lock left behind by a crashed holder is reclaimed once stale.
 */
export async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
  const lock = path.join(RUNTIME_DIR, ".state.lock");
  await mkdir(RUNTIME_DIR, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      await mkdir(lock);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const age = await stat(lock).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > LOCK_STALE_MS) {
        await rm(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new StateBusyError("the record is busy");
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lock, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function writeState(state: TrustedState): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tmp = `${RUNTIME_STATE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  await rename(tmp, RUNTIME_STATE);
}
