import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { readPdfPages } from "@/lib/extraction/pdfText";
import { parseRichState } from "./schema";
import { verifyRichState } from "./verify";
export const RICH_DIRECTORY=path.join(process.cwd(),"data","rich-synthetic");
export const RICH_DOCUMENTS=path.join(RICH_DIRECTORY,"documents");

/** Immutable fixture only. No readState, init/reset, pending proposals or writeState. */
export const readRichState=cache(async function readRichState() {
  const state=parseRichState(JSON.parse(await readFile(path.join(RICH_DIRECTORY,"state.json"),"utf8")));
  const pages=new Map<string,string[]>(await Promise.all(state.documents.map(async d=>{
    const bytes=await readFile(path.join(RICH_DOCUMENTS,d.file));
    return [d.id,await readPdfPages(new Uint8Array(bytes))] as [string,string[]];
  })));
  const failures=verifyRichState(state,pages);
  if(failures.length) throw new Error("Rich fixture verification failed: "+JSON.stringify(failures));
  return state;
});
