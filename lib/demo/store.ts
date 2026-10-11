import { createHash,randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile,rename,access } from "node:fs/promises";
import path from "node:path";
import type { RichSyntheticState } from "@/lib/model/rich";
import type { RichOverlay,RecordState } from "./model";
import { parseOverlay } from "./schema";
import { readRichState,RICH_DIRECTORY,RICH_DOCUMENTS } from "@/lib/rich/read";
import { RICH_OVERLAY,RICH_RUNTIME_DIR,RICH_UPLOADS } from "./paths";
import { readPdfPages } from "@/lib/extraction/pdfText";
import { verifySeedState } from "@/lib/extraction/verify";
import { StateCorruptedError } from "@/lib/store/stateStore";
export async function readBaseline() {
 const baseline=await readRichState(), hash=createHash("sha256");
 hash.update(await readFile(path.join(RICH_DIRECTORY,"state.json")));
 for(const d of baseline.documents)hash.update(await readFile(path.join(RICH_DOCUMENTS,d.file)));
 return {baseline,digest:hash.digest("hex")};
}
export function emptyOverlay(digest:string):RichOverlay{return {version:1,profile:"rich",baselineDigest:digest,revision:0,documents:[],facts:[],episodes:[],latestUpdate:null};}
export function composeRecord(base:RichSyntheticState,overlay:RichOverlay):RecordState {
 const documents=[...base.documents,...overlay.documents],facts=[...base.facts,...overlay.facts];
 if(new Set(documents.map(d=>d.id)).size!==documents.length || new Set(facts.map(f=>f.id)).size!==facts.length || new Set(documents.map(d=>d.file)).size!==documents.length)throw new StateCorruptedError("Duplicate rich record identities");
 const added=new Map(overlay.documents.map(d=>[d.id,d]));
 if(overlay.documents.some(d=>d.file!==d.id+".pdf") || overlay.facts.some(f=>!added.has(f.source.documentId)||f.source.page>added.get(f.source.documentId)!.pageCount||!f.id.startsWith(f.source.documentId+"-")))throw new StateCorruptedError("Live fact source is missing");
 if(overlay.documents.some(d=>!overlay.facts.some(f=>f.source.documentId===d.id)))throw new StateCorruptedError("Live document has no approved facts");
 if(overlay.latestUpdate && (!added.has(overlay.latestUpdate.documentId)||overlay.latestUpdate.approvedFactIds.some(id=>!overlay.facts.some(f=>f.id===id&&f.source.documentId===overlay.latestUpdate!.documentId))))throw new StateCorruptedError("Invalid latest update");
 return {...base,readOnly:false,documents,facts,episodes:[...base.episodes,...overlay.episodes.filter(e=>!base.episodes.some(b=>b.id===e.id))],latestUpdate:overlay.latestUpdate};
}
export async function readRichRecord() {
 const {baseline,digest}=await readBaseline();let overlay:RichOverlay;
 try{overlay=parseOverlay(JSON.parse(await readFile(RICH_OVERLAY,"utf8")));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")overlay=emptyOverlay(digest);else throw new StateCorruptedError("Rich approved additions are invalid");}
 if(overlay.baselineDigest!==digest)throw new StateCorruptedError("Rich baseline revision does not match approved additions");
 const record=composeRecord(baseline,overlay);
 const pages=new Map<string,string[]>(await Promise.all(overlay.documents.map(async doc=>[doc.id,await readPdfPages(new Uint8Array(await readFile(path.join(RICH_UPLOADS,doc.file))))] as [string,string[]])));
 if(overlay.documents.some(d=>pages.get(d.id)?.length!==d.pageCount) || verifySeedState({version:1,patient:record.patient,seededAt:record.seededAt,documents:overlay.documents,episodes:record.episodes,facts:overlay.facts,latestUpdate:null},pages).length)throw new StateCorruptedError("Approved additions fail source verification");
 return {baseline,digest,overlay,record};
}
export async function writeOverlay(overlay:RichOverlay) {
 const validated=parseOverlay(overlay);await mkdir(RICH_RUNTIME_DIR,{recursive:true});
 const tmp=RICH_OVERLAY+"."+randomUUID()+".tmp";
 await writeFile(tmp,JSON.stringify(validated,null,2)+"\n","utf8");await rename(tmp,RICH_OVERLAY);
}
