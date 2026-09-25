/**
 * DEV-ONLY internal harness for slice 1 — NOT product scope, not a records library.
 * Returns 404 outside development. Deleted in slice 3 (see devpost/checklist.md).
 */
import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import type { TrustedState } from "@/lib/model/types";
import { SEED_STATE } from "@/lib/store/paths";

export const dynamic = "force-dynamic";

export default async function DevDocuments() {
  if (process.env.NODE_ENV !== "development") notFound();
  const state = JSON.parse(await readFile(SEED_STATE, "utf8")) as TrustedState;
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 32, maxWidth: 720 }}>
      <p style={{ color: "#8a5a00" }}>Dev-only harness (slice 1). Not part of the product.</p>
      <h1 style={{ fontSize: 20 }}>Seed documents — {state.patient.displayName} (fictional)</h1>
      <ul>
        {state.documents.map((d) => (
          <li key={d.id} style={{ margin: "8px 0" }}>
            <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">
              {d.id} · {d.title} · {d.issuer} · {d.date} ({d.pageCount} p.)
            </a>
          </li>
        ))}
      </ul>
      <p>The live demo record is not served here: open <code>demo-files/follow-up-consultation-2026-09-25.pdf</code> directly.</p>
    </main>
  );
}
