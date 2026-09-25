/**
 * Document Route — streams the PDF for a KNOWN document id only. Spec: `spec.md > Document Route`.
 * Unknown id -> 404. The file name comes from trusted state, never from the request.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TrustedState } from "@/lib/model/types";
import { RUNTIME_DOCUMENTS, RUNTIME_STATE, SEED_DOCUMENTS, SEED_STATE } from "@/lib/store/paths";

export const dynamic = "force-dynamic";

async function loadState(): Promise<TrustedState> {
  try {
    return JSON.parse(await readFile(RUNTIME_STATE, "utf8"));
  } catch {
    return JSON.parse(await readFile(SEED_STATE, "utf8"));
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await loadState();
  const doc = state.documents.find((d) => d.id === id);
  if (!doc) return new Response("Not found", { status: 404 });

  const dir = doc.origin === "seed" ? SEED_DOCUMENTS : RUNTIME_DOCUMENTS;
  try {
    const bytes = await readFile(path.join(dir, path.basename(doc.file)));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(doc.file)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
