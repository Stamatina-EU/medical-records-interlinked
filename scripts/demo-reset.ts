/** Profile-specific reset: never deletes the other demo's runtime or either immutable baseline. */
import { copyFile,mkdir,rm } from "node:fs/promises";
import path from "node:path";
import { demoProfile } from "../lib/demo/profile";
import { resetRichRecord } from "../lib/demo/reset";
import { withStateLock } from "../lib/store/stateLock";
async function main(){
 const profile=process.argv.includes("--legacy")?"legacy":process.argv.includes("--rich")?"rich":demoProfile();
 if(profile==="rich")await resetRichRecord();
 else {
  const root=path.resolve(__dirname,".."),runtime=path.join(root,"data","runtime");
  await withStateLock(async()=>{
   for(const name of ["documents","pending"]){const target=path.resolve(runtime,name);if(!target.startsWith(runtime+path.sep))throw new Error("Unsafe legacy reset path");await rm(target,{recursive:true,force:true});}
   await mkdir(runtime,{recursive:true});await copyFile(path.join(root,"data","seed","state.json"),path.join(runtime,"state.json"));
  });
 }
 console.log(`Demo reset: ${profile} restored; the other profile and both immutable baselines preserved.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
