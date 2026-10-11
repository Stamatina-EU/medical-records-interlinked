/** Deterministic rich-record Summary. No AI, diagnosis, medical ranking, conversion or allergy inference. */
import type { DoctorSummary,Statement,SummarySection,SummaryRef } from "@/lib/summary/compose";
import { refKey } from "@/lib/summary/compose";
import type { RecordState } from "./model";
import { recordCalculations } from "./record";
import { laboratoryGroups } from "@/lib/rich/derive";
import { formatDate } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";
export function composeRichSummary(state:RecordState):DoctorSummary {
 const claims=recordCalculations(state),byClaim=new Map(claims.map(c=>[c.key,c])),byFact=new Map(state.facts.map(f=>[f.id,f]));
 const affected=new Set(state.latestUpdate?.affected??[]),sections:SummarySection[]=[];
 const fact=(id:string):SummaryRef=>({type:"fact",id}),claim=(key:string):SummaryRef=>({type:"claim",key});
 const statement=(text:string,refs:SummaryRef[],derived=false):Statement=>({text,refs,derived,updated:refs.some(r=>r.type==="fact"?affected.has(r.id):affected.has(r.key)||byClaim.get(r.key)?.inputFactIds.some(id=>affected.has(id))===true)});
 const add=(id:string,title:string,statements:Statement[])=>{if(statements.length)sections.push({id,title,statements});};
 const overview=byClaim.get("rich:laboratory-overview")!,picture=[statement(overview.text+".",[claim(overview.key)],true)];
 const treatmentClaim=byClaim.get("record-treatments");if(treatmentClaim)picture.push(statement(treatmentClaim.text+".",[claim(treatmentClaim.key)],true));
 for(const c of claims.filter(c=>c.kind==="followup_match"))picture.push(statement(c.text+". This establishes chronology only.",[claim(c.key)],true));
 add("picture","Current documented picture",picture);
 const labs:Statement[]=[];
 for(const g of laboratoryGroups(state)){
  const key=`rich:latest:${g.id}`;labs.push(statement(`${g.label}: latest documented date ${formatDate(g.latest[0].measuredOn)}; ${g.measurements.length} results in this record.`,[claim(key)],true));
  for(const f of g.latest)labs.push(statement(`${g.label} — ${f.value} ${f.unit} · ${formatDate(f.measuredOn)}${f.refText?` · supplied range ${f.refText} ${f.unit}`:" · supplied range not provided"}.`,[fact(f.id)]));
 }
 add("laboratory","Laboratory measurements",labs);
 const meds=state.facts.filter(f=>f.kind==="medication_status").sort((a,b)=>a.documentedOn.localeCompare(b.documentedOn)||a.id.localeCompare(b.id));
 add("medication","Medication statements",meds.map(f=>statement(`${state.episodes.find(e=>e.id===f.episodeId)?.name??"Medication"} — ${statusLabel(f.status)} · documented ${formatDate(f.documentedOn)}.`,[fact(f.id)])));
 const exams=state.facts.filter(f=>f.kind==="imaging_exam").sort((a,b)=>a.performedOn.localeCompare(b.performedOn)||a.id.localeCompare(b.id));
 add("imaging","Imaging",exams.map(f=>statement(`${f.examName} · ${formatDate(f.performedOn)}. ${f.statement}`,[fact(f.id)])));
 const recs=state.facts.filter(f=>f.kind==="follow_up").sort((a,b)=>a.recommendedOn.localeCompare(b.recommendedOn)||a.id.localeCompare(b.id));
 add("recommendations","Documented recommendations",recs.map(f=>statement(`${formatDate(f.recommendedOn)}: “${f.recommendation}”`,[fact(f.id)])));
 const incidents=state.facts.filter(f=>f.kind==="documented_incident");
 add("incidents","Documented incident",incidents.flatMap(f=>[
  statement(f.statement,[fact(f.id)]),
  statement(`${f.occurredOn?`Incident date ${formatDate(f.occurredOn)}`:"Incident date not supplied"} · document date ${formatDate(f.documentedOn)}.`,[fact(f.id)])
 ]));
 const order:string[]=[],sourceNumbers:Record<string,number[]>={};
 for(const section of sections)for(const st of section.statements)for(const ref of st.refs){
  const ids=ref.type==="fact"?[ref.id]:byClaim.get(ref.key)?.inputFactIds;
  if(!ids?.length)throw new Error("Summary evidence reference does not resolve");
  const nums=new Set<number>();
  for(const id of ids){const f=byFact.get(id);if(!f||!state.documents.some(d=>d.id===f.source.documentId))throw new Error("Summary source does not resolve");
   if(!order.includes(f.source.documentId))order.push(f.source.documentId);nums.add(order.indexOf(f.source.documentId)+1);}
  sourceNumbers[refKey(ref)]=[...nums].sort((a,b)=>a-b);
 }
 return {patientName:state.patient.displayName,documentCount:state.documents.length,latestSourceDate:state.documents.reduce((date,d)=>d.date>date?d.date:date,""),sections,
  claims,sources:order.map((id,i)=>({n:i+1,document:state.documents.find(d=>d.id===id)!})),sourceNumbers};
}
