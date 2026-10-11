import { mkdir,readFile,writeFile,rm,readdir } from "node:fs/promises";
import path from "node:path";
import type { Proposal } from "@/lib/model/types";
import { RICH_PENDING,checkedRichPath } from "./paths";
import { parseBoundProposal,parseLiveProposal } from "./schema";
const valid=/^[a-f0-9-]{36}$/;
function dir(id:string){if(!valid.test(id))throw new Error("Invalid proposal id");return checkedRichPath(path.join(RICH_PENDING,id));}
export async function saveRichProposal(proposal:Proposal,bytes:Uint8Array,digest:string){
 parseLiveProposal(proposal);const folder=dir(proposal.proposalId);await mkdir(folder,{recursive:true});
 await writeFile(path.join(folder,"source.pdf"),bytes);await writeFile(path.join(folder,"proposal.json"),JSON.stringify({profile:"rich",baselineDigest:digest,proposal}),"utf8");
}
export async function loadRichProposal(id:string){try{return parseBoundProposal(JSON.parse(await readFile(path.join(dir(id),"proposal.json"),"utf8")));}catch{return null;}}
export async function richProposalPdf(id:string){return new Uint8Array(await readFile(path.join(dir(id),"source.pdf")));}
export async function deleteRichProposal(id:string){try{await rm(dir(id),{recursive:true,force:true});}catch{/* already gone or invalid id */}}
export async function clearRichPending(){let entries:string[];try{entries=await readdir(RICH_PENDING);}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return;throw e;}for(const entry of entries)await rm(checkedRichPath(path.join(RICH_PENDING,entry)),{recursive:true,force:true});}
