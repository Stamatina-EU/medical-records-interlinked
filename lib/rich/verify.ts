/**
 * Rich FIXTURE verifier. This module is never imported by the live extraction/apply pipeline.
 * Positive, bounded source grammars for the authored lab rows and ED note; no AI inference.
 */
import type { RichSyntheticState } from "@/lib/model/rich";
import type { SourceFact, TrustedState } from "@/lib/model/types";
import { locateExcerpt, verifyDocumentDate, verifySeedState, type SeedFailure } from "@/lib/extraction/verify";
import { formatDate } from "@/lib/text/dates";
import { analyteLabel } from "./catalog";

export function verifyRichState(state: RichSyntheticState, pagesByDocId: Map<string,string[]>): SeedFailure[] {
  const failures: SeedFailure[] = [];
  const docs = new Map(state.documents.map(d=>[d.id,d]));
  const fail = (factId:string,page:number,check:string)=>failures.push({factId,page,check});
  for (const [label, ids] of [["document",state.documents.map(d=>d.id)],["fact",state.facts.map(f=>f.id)],["episode",state.episodes.map(e=>e.id)]] as const) {
    if(new Set(ids).size!==ids.length) fail("state",0,`duplicate ${label} id`);
  }
  for (const doc of state.documents) {
    const pages=pagesByDocId.get(doc.id);
    if(!pages) {fail(doc.id,0,"PDF missing");continue;}
    if(pages.length!==doc.pageCount) fail(doc.id,0,"PDF page count mismatch");
    const dated=verifyDocumentDate(doc.date,pages);
    if(!dated.ok) fail(doc.id,1,dated.reason);
    const header=pages[0].replace(/\s+/g," ");
    if(!header.toUpperCase().includes(doc.title.toUpperCase()) || !header.toUpperCase().includes(doc.issuer.toUpperCase())) fail(doc.id,1,"document title or issuer not present in source");
  }
  for (const fact of state.facts) {
    const doc=docs.get(fact.source.documentId), pages=pagesByDocId.get(fact.source.documentId);
    if(!doc || !pages) {fail(fact.id,fact.source.page,"unknown source document");continue;}
    const loc=locateExcerpt(pages,fact.source.page,fact.source.verifiedExcerpt);
    if(!loc.ok) {fail(fact.id,fact.source.page,loc.reason);continue;}
    if(loc.verifiedExcerpt!==fact.source.verifiedExcerpt) {fail(fact.id,fact.source.page,"excerpt is not exactly canonical source text");continue;}
    const source=loc.verifiedExcerpt.replace(/\s+/g," ");
    if(fact.kind==="lab_measurement" || fact.kind==="documented_incident" || fact.kind==="imaging_exam") {
      const page=pages[fact.source.page-1];
      const before=page.slice(page.lastIndexOf("\n",loc.from-1)+1,loc.from).trim();
      const nextNewline=page.indexOf("\n",loc.to);
      const after=page.slice(loc.to,nextNewline<0?page.length:nextNewline).trim();
      if(before || after) fail(fact.id,fact.source.page,"excerpt must own complete source lines, not a fragment inside qualified wording");
    }
    if(fact.kind==="imaging_exam") {
      // Fixture-only examination-role grammar: the first examination date is the performed date.
      // The comparison date stays in the verified quotation and is checked separately below.
      const performed=/^Thyroid ultrasound performed on (\d{1,2} [A-Z][a-z]{2} \d{4})\./.exec(source);
      const comparison=/^Thyroid ultrasound of (\d{1,2} [A-Z][a-z]{2} \d{4}) compared with the thyroid ultrasound of \d{1,2} [A-Z][a-z]{2} \d{4}\./.exec(source);
      const examinationDate=performed?.[1] ?? comparison?.[1];
      if(fact.examName!=="Thyroid ultrasound" || examinationDate!==formatDate(fact.performedOn))
        fail(fact.id,fact.source.page,"performedOn does not match the examination date source role");
    }
    if(fact.kind==="medication_status" && fact.documentedOn!==doc.date) fail(fact.id,fact.source.page,"medication statement date does not match its document");
    if(fact.kind==="follow_up" && fact.recommendedOn!==doc.date) fail(fact.id,fact.source.page,"recommendation date does not match its document");
    if(fact.kind==="lab_measurement") {
      if(doc.documentType!=="lab_report") fail(fact.id,fact.source.page,"measurement must belong to a lab report");
      const m=/^(.+?) on (\d{1,2} [A-Z][a-z]{2} \d{4}): (\d+(?:\.\d+)?) ([^()]+?) \(supplied range (\d+(?:\.\d+)?)–(\d+(?:\.\d+)?) ([^()]+?)\)\.$/.exec(source);
      if(!m || m[1]!==analyteLabel(fact.analyte) || m[2]!==formatDate(fact.measuredOn) ||
        Number(m[3])!==fact.value || m[4]!==fact.unit || Number(m[5])!==fact.refLow ||
        Number(m[6])!==fact.refHigh || m[7]!==fact.unit || `${m[5]}–${m[6]}`!==fact.refText ||
        Number(m[5])>Number(m[6])) fail(fact.id,fact.source.page,"lab row does not bind exact analyte/value/unit/date/own supplied range");
    }
    if(fact.kind==="documented_incident") {
      const m=/^(?:Incident date: (\d{1,2} [A-Z][a-z]{2} \d{4})\. )?(Anaphylaxis occurred after amoxicillin\. Epinephrine was administered in the emergency department\.)$/.exec(source);
      if(!m || m[2]!==fact.statement || (m[1]??null)!==(fact.occurredOn ? formatDate(fact.occurredOn):null) || fact.documentedOn!==doc.date)
        fail(fact.id,fact.source.page,"incident wording/date is not explicitly bound to the source; no inferred allergy or causality");
    }
  }
  // Reuse the original verifier only for its original supported source-fact kinds.
  const supported: SourceFact[]=state.facts.filter((f): f is SourceFact => f.kind!=="lab_measurement" && f.kind!=="documented_incident");
  const projection: TrustedState={version:1,patient:state.patient,seededAt:state.seededAt,documents:state.documents,episodes:state.episodes,facts:supported,latestUpdate:null};
  failures.push(...verifySeedState(projection,pagesByDocId));
  return failures;
}
