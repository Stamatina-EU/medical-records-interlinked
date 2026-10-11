/** GET-only immutable rich fixture PDFs. Never reads runtime state or user-provided filenames. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readRichState,RICH_DOCUMENTS } from "@/lib/rich/read";
export const dynamic="force-dynamic";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 try {
  const state=await readRichState(),doc=state.documents.find(d=>d.id===id);
  if(!doc) return new Response("Not found",{status:404});
  const bytes=await readFile(path.join(RICH_DOCUMENTS,doc.file));
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${doc.file}"`,"Cache-Control":"no-store"}});
 } catch {return new Response("Rich fixture unavailable",{status:500});}
}
