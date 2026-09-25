/**
 * State Store — SERVER ONLY. Spec: `spec.md > State Store`.
 * Reads data/runtime/state.json, initialising it from the committed seed if missing.
 * Writes atomically (temp file + rename). A corrupted runtime file is reported, never silently
 * overwritten — the fix is `npm run demo:reset`.
 */
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { TrustedState } from "@/lib/model/types";
import { RUNTIME_DIR, RUNTIME_STATE, SEED_STATE } from "@/lib/store/paths";

export class StateCorruptedError extends Error {}

async function exists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

export async function readState(): Promise<TrustedState> {
  if (!(await exists(RUNTIME_STATE))) {
    await mkdir(RUNTIME_DIR, { recursive: true });
    await copyFile(SEED_STATE, RUNTIME_STATE);
  }
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

export async function writeState(state: TrustedState): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tmp = `${RUNTIME_STATE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  await rename(tmp, RUNTIME_STATE);
}
