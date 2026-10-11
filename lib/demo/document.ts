import { readFile } from "node:fs/promises";
import path from "node:path";
import { readRichRecord } from "./store";
import { RICH_DOCUMENTS } from "@/lib/rich/read";
import { RICH_UPLOADS } from "./paths";
export async function richDocument(id:string){
 try{const {record}=await readRichRecord(),doc=record.documents.find(d=>d.id===id);
  if(!doc)return new Response("Not found",{status:404});
  const bytes=await readFile(path.join(doc.origin==="seed"?RICH_DOCUMENTS:RICH_UPLOADS,path.basename(doc.file)));
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${path.basename(doc.file)}"`,"Cache-Control":"no-store"}});
 }catch{return new Response("Record unavailable",{status:500});}
}
