/** Filesystem locations for seed and runtime data (server only). Spec: `spec.md > Data Model`. */
import path from "node:path";

export const ROOT = process.cwd();
export const SEED_DIR = path.join(ROOT, "data", "seed");
export const SEED_STATE = path.join(SEED_DIR, "state.json");
export const SEED_DOCUMENTS = path.join(SEED_DIR, "documents");
export const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
export const RUNTIME_STATE = path.join(RUNTIME_DIR, "state.json");
export const RUNTIME_DOCUMENTS = path.join(RUNTIME_DIR, "documents");
export const PENDING_DIR = path.join(RUNTIME_DIR, "pending");
