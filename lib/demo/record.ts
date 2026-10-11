import type { SourceFact,TrustedState,Proposal,ProposedFact,ChangeLine } from "@/lib/model/types";
import type { RecordState } from "./model";
import { derive } from "@/lib/engine/derive";
import { recordClaims } from "@/lib/engine/recordClaims";
import { describeChanges } from "@/lib/engine/changes";
import { richClaims } from "@/lib/rich/derive";
/** Projection is only a live-engine context. Never persist it as the complete rich record. */
export function liveContext(state:RecordState):TrustedState {
 const facts=state.facts.filter((f):f is SourceFact=>f.kind!=="documented_incident" && (f.kind!=="lab_measurement" || f.analyte==="ferritin"));
 return {version:1,patient:state.patient,seededAt:state.seededAt,documents:state.documents,episodes:state.episodes,facts,latestUpdate:state.latestUpdate};
}
export function recordCalculations(state:RecordState) {
 const context=liveContext(state);
 const original=derive(context).filter(c=>{
  if(c.kind!=="changed_since_previous") return true;
  const [a,b]=c.inputFactIds.map(id=>context.facts.find(f=>f.id===id));
  return a?.kind==="lab_measurement" && b?.kind==="lab_measurement" && a.unit===b.unit && a.measuredOn<b.measuredOn;
 });
 return [...original,...recordClaims(context),...richClaims(state)];
}
/** Exact units AND own ranges: no normalization, and different supplied bounds remain separate facts. */
export function dedupeLive(approved:SourceFact[],proposed:ProposedFact[]) {
 const fresh:ProposedFact[]=[],duplicates:ProposedFact[]=[];
 for(const p of proposed) {
  const match=[...approved,...fresh].some(f=>p.kind==="lab_measurement" && f.kind==="lab_measurement"
   ? p.analyte===f.analyte && p.measuredOn===f.measuredOn && p.value===f.value && p.unit===f.unit && p.refLow===f.refLow && p.refHigh===f.refHigh && p.refText===f.refText
   : p.kind==="medication_status" && f.kind==="medication_status" && p.episodeId===f.episodeId && p.documentedOn===f.documentedOn && p.status===f.status);
  (match?duplicates:fresh).push(p);
 }
 return {fresh,duplicates};
}
export function recordChanges(before:RecordState,after:RecordState):ChangeLine[] {
 const lines=describeChanges(liveContext(before),liveContext(after));
 const old=new Map(recordCalculations(before).map(c=>[c.key,c.text]));
 for(const c of recordCalculations(after)) if((c.key==="rich:laboratory-overview" || c.key.startsWith("rich:latest:")) && old.get(c.key)!==c.text) lines.push({text:c.text,ref:{type:"claim",key:c.key}});
 return lines;
}
export function recordAffected(before:RecordState,after:RecordState) {
 const old=new Map(recordCalculations(before).map(c=>[c.key,JSON.stringify(c)])),ids=new Set(before.facts.map(f=>f.id));
 return [...after.facts.filter(f=>!ids.has(f.id)).map(f=>f.id),...recordCalculations(after).filter(c=>old.get(c.key)!==JSON.stringify(c)).map(c=>c.key)];
}
export function previewRecord(state:RecordState,proposal:Proposal,ids:string[]):ChangeLine[] {
 const selected=proposal.facts.filter(f=>ids.includes(f.id)).map(f=>({...f,review:"APPROVED" as const}));
 if(!selected.length)return [];
 return recordChanges(state,{...state,documents:[...state.documents,proposal.document],facts:[...state.facts,...selected]});
}
export function recordChangesSummary(state:RecordState) {
 if(!state.latestUpdate)return [];
 const added=new Set(state.latestUpdate.approvedFactIds);
 return recordChanges({...state,documents:state.documents.filter(d=>d.id!==state.latestUpdate!.documentId),facts:state.facts.filter(f=>!added.has(f.id)),latestUpdate:null},state);
}
