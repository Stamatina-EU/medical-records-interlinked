import { demoProfile } from "@/lib/demo/profile";
import { richDocument } from "@/lib/demo/document";
/**
 * Document Route — streams the PDF for a KNOWN document id only. Spec: `spec.md > Document Route`.
 * Unknown id -> 404. The file name comes from trusted state, never from the request.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readState } from "@/lib/store/stateStore";
import { RUNTIME_DOCUMENTS, SEED_DOCUMENTS } from "@/lib/store/paths";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (demoProfile() === "rich") return richDocument(id);
  let doc;
  try {
    doc = (await readState()).documents.find((d) => d.id === id);
  } catch {
    return new Response("History unavailable", { status: 500 });
  }
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
