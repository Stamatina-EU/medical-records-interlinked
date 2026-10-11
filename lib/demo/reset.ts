import { rm,readdir } from "node:fs/promises";
import path from "node:path";
import { readBaseline,emptyOverlay,writeOverlay } from "./store";
import { withStateLock } from "./richLock";
import { RICH_PENDING,RICH_UPLOADS,RICH_RUNTIME_DIR,checkedRichPath } from "./paths";
export async function resetRichRecord(){
 const {digest}=await readBaseline(); // fail closed before deleting anything if the immutable baseline is corrupt
 await withStateLock(async()=>{
  await writeOverlay(emptyOverlay(digest));
  for(const target of [RICH_PENDING,RICH_UPLOADS])await rm(checkedRichPath(target),{recursive:true,force:true});
  for(const name of await readdir(RICH_RUNTIME_DIR))if(name.endsWith('.tmp')||name.startsWith('.state.lock.tmp-'))await rm(checkedRichPath(path.join(RICH_RUNTIME_DIR,name)),{recursive:true,force:true});
 });
}
