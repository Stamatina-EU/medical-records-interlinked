import { NextResponse } from "next/server";
import { mkdir,writeFile,rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { rejectForeignOrigin } from "@/lib/http/originGuard";
import { extractFacts } from "@/lib/extraction/extract";
import { runExtractionPipeline,outcomeLogLine } from "@/lib/extraction/pipeline";
import { readPdfPages } from "@/lib/extraction/pdfText";
import { verifySeedState } from "@/lib/extraction/verify";
import { validateApproval,rebaseProposal,rebaseFactId } from "@/lib/engine/apply";
import { nextDocumentId } from "@/lib/extraction/documentMeta";
import { StateBusyError } from "@/lib/store/stateLock";
import { readRichRecord,composeRecord,writeOverlay } from "./store";
import { withStateLock } from "./richLock";
import { liveContext,dedupeLive,recordAffected } from "./record";
import { saveRichProposal,loadRichProposal,richProposalPdf,deleteRichProposal } from "./proposals";
import { RICH_UPLOADS } from "./paths";
export async function richExtract(req:Request) {
 const foreign=rejectForeignOrigin(req);if(foreign)return foreign;
 let file:FormDataEntryValue|null;try{file=(await req.formData()).get("file");}catch{return NextResponse.json({status:"unsupported_file",code:"not_pdf"},{status:400});}
 if(!(file instanceof File))return NextResponse.json({status:"unsupported_file",code:"not_pdf"},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer()),{record,digest}=await readRichRecord();
 const outcome=await runExtractionPipeline(bytes,liveContext(record),{extract:extractFacts,newProposalId:randomUUID,now:()=>new Date().toISOString(),dedupeFacts:dedupeLive});
 console.info(outcomeLogLine(outcome));
 if(outcome.status==="proposal"){
  await saveRichProposal(outcome.proposal,bytes,digest);
  return NextResponse.json({status:"proposal",proposal:outcome.proposal,state:record});
 }
 return NextResponse.json(outcome,{status:outcome.status==="processing_failed"&&outcome.code==="ai_unavailable"?502:200});
}
export async function richApply(req:Request) {
 const foreign=rejectForeignOrigin(req);if(foreign)return foreign;
 let body:{proposalId?:unknown;approvedFactIds?:unknown};try{body=await req.json();}catch{return NextResponse.json({ok:false,reason:"invalid request"},{status:400});}
 if(typeof body.proposalId!=="string")return NextResponse.json({ok:false,reason:"missing proposal"},{status:400});
 const proposalId=body.proposalId;
 try{return await withStateLock(async()=>{
  const bound=await loadRichProposal(proposalId);if(!bound)return NextResponse.json({ok:false,reason:"proposal not found"},{status:404});
  const {baseline,digest,record,overlay}=await readRichRecord();
  if(bound.profile!=="rich"||bound.baselineDigest!==digest)return NextResponse.json({ok:false,reason:"record profile or baseline changed"},{status:409});
  const proposal=bound.proposal,check=validateApproval(proposal,body.approvedFactIds);
  if(!check.ok)return NextResponse.json({ok:false,reason:check.reason},{status:400});
  // Recheck the server-owned PDF with the UNCHANGED narrow verifier before accepting any live facts.
  const bytes=await richProposalPdf(proposalId),pages=await readPdfPages(bytes);
  const verified=verifySeedState({version:1,patient:record.patient,seededAt:record.seededAt,documents:[proposal.document],episodes:record.episodes,
   facts:proposal.facts.map(f=>({...f,review:"APPROVED" as const})),latestUpdate:null},new Map([[proposal.document.id,pages]]));
  if(pages.length!==proposal.document.pageCount||verified.length)return NextResponse.json({ok:false,reason:"source verification failed"},{status:400});
  const {fresh}=dedupeLive(liveContext(record).facts,check.approved);
  if(!fresh.length){await deleteRichProposal(proposalId);return NextResponse.json({ok:true,status:"no_changes"});}
  const final=rebaseProposal(proposal,nextDocumentId(liveContext(record))),ids=fresh.map(f=>rebaseFactId(f.id,proposal.document.id,final.document.id));
  if(record.documents.some(d=>d.id===final.document.id||d.file===final.document.file)||final.facts.some(f=>record.facts.some(x=>x.id===f.id)))return NextResponse.json({ok:false,reason:"identity conflict"},{status:409});
  const selected=new Set(ids),facts=final.facts.filter(f=>selected.has(f.id)).map(f=>({...f,review:"APPROVED" as const}));
  const next={...overlay,revision:overlay.revision+1,documents:[...overlay.documents,final.document],facts:[...overlay.facts,...facts]};
  const composed=composeRecord(baseline,next);
  next.latestUpdate={documentId:final.document.id,approvedFactIds:ids,affected:recordAffected(record,composed),approvedAt:new Date().toISOString()};
  await mkdir(RICH_UPLOADS,{recursive:true});const target=path.join(RICH_UPLOADS,final.document.file),tmp=target+"."+randomUUID()+".tmp";
  await writeFile(tmp,bytes);await rename(tmp,target);await writeOverlay(next);await deleteRichProposal(proposalId);
  return NextResponse.json({ok:true,status:"applied"});
 });}catch(e){if(e instanceof StateBusyError)return NextResponse.json({ok:false,reason:"busy"},{status:503});throw e;}
}
export async function richCancel(req:Request){const foreign=rejectForeignOrigin(req);if(foreign)return foreign;try{const body=await req.json();if(typeof body.proposalId==="string")await deleteRichProposal(body.proposalId);}catch{}return NextResponse.json({ok:true});}
