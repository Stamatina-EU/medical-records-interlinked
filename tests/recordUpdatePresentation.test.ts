import { beforeAll,describe,expect,it,vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { parseRichState } from "@/lib/rich/schema";
import type { RecordState } from "@/lib/demo/model";
import type { Proposal } from "@/lib/model/types";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { dedupeLive,liveContext,recordCalculations,recordChangesSummary } from "@/lib/demo/record";
import { richEvidence } from "@/lib/rich/evidence";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import WhatChanged from "@/components/snapshot/WhatChanged";
import RichRecord from "@/components/rich/RichRecord";
import CalculatedClaimView from "@/components/evidence/CalculatedClaimView";
import RichDoctorSummary from "@/components/rich/RichDoctorSummary";
import SourceFactView from "@/components/evidence/SourceFactView";
import { composeRichSummary } from "@/lib/demo/summary";
import { calculationText, calculationExplanation } from "@/lib/view/calculationCopy";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh(){}})}));
const baseline:RecordState=parseRichState(JSON.parse(readFileSync("data/rich-synthetic/state.json","utf8")));
let proposal:Proposal;
beforeAll(async()=>{
 const result=await runExtractionPipeline(new Uint8Array(readFileSync("demo-files/follow-up-consultation-2026-09-25.pdf")),liveContext(baseline),{
  extract:async()=>({status:"ok",model:"deterministic-test-stub",extraction:{
   document:{documentType:"Follow-up consultation note",documentDate:"2026-09-25",page:1,excerpt:"Date of consultation 25 Sep 2026"},
   labMeasurements:[{analyteName:"Ferritin",value:32,unit:"μg/L",referenceRangeText:"15–150 μg/L",measuredOn:"2026-09-25",page:2,excerpt:"Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)."}],
   medicationStatements:[{medicationName:"oral iron (ferrous sulfate)",status:"current",page:1,excerpt:"The patient continues to take oral iron (ferrous sulfate) once daily."}]
  }}),dedupeFacts:dedupeLive,newProposalId:()=>"record-story-presentation-test",now:()=>"2026-10-14T10:00:00.000Z"
 });
 if(result.status!=="proposal")throw new Error(result.status);
 proposal=result.proposal;
});
function approved(kinds:string[]):RecordState {
 const facts=proposal.facts.filter(f=>kinds.includes(f.kind)).map(f=>({...f,review:"APPROVED" as const}));
 return {...baseline,documents:[...baseline.documents,proposal.document],facts:[...baseline.facts,...facts],latestUpdate:{documentId:proposal.document.id,approvedFactIds:facts.map(f=>f.id),affected:[],approvedAt:"2026-10-14T10:00:00.000Z"}};
}
function renderUpdate(state:RecordState,compact=true) {
 return renderToStaticMarkup(createElement(EvidenceProvider,{index:richEvidence(state,true),children:createElement(WhatChanged,{document:proposal.document,changes:recordChangesSummary(state),compact,heading:compact?"Latest approved update":undefined})}));
}
function group(html:string,name:string) { return html.split(`data-update-group="${name}"`)[1]?.split("</ul>")[0]??""; }
describe("approved update presentation retains trusted evidence semantics",()=>{
 it("groups both approved source facts separately from their two record consequences and retains the overview below",()=>{
  const state=approved(["lab_measurement","medication_status"]),saved=JSON.stringify(state),claims=JSON.stringify(recordCalculations(state));
  const html=renderUpdate(state),added=group(html,"added"),calculated=group(html,"calculated");
  expect(added.match(/<li /g)).toHaveLength(2);expect(calculated.match(/<li /g)).toHaveLength(2);
  expect(added).toContain("New ferritin measurement · 32 μg/L · 25 Sep 2026");expect(added).toContain("Oral iron · Ongoing · documented 25 Sep 2026");
  expect(added).not.toContain("Later ferritin result documented");expect(added).not.toContain("Ferritin history");
  expect(calculated).toContain("Later ferritin result documented");expect(calculated).toContain("Ferritin history now contains 3 results");expect(calculated).toContain("latest 25 Sep 2026");
  expect(calculated).not.toContain('data-evidence-kind="source"');expect(html).not.toContain("documented measurements across");
  for(const fact of state.facts.filter(f=>state.latestUpdate!.approvedFactIds.includes(f.id)))expect(added).toContain(`page ${fact.source.page}`);
  const record=renderToStaticMarkup(createElement(EvidenceProvider,{index:richEvidence(state,true),children:createElement(RichRecord,{state,integrated:true})}));
  expect(record).toContain("11 measurements");expect(record).toContain("5 analytes");
  expect(JSON.stringify(state)).toBe(saved);expect(JSON.stringify(recordCalculations(state))).toBe(claims);
 });
 it("ferritin-only approval never presents an unapproved medication and keeps its two calculations together",()=>{
  const html=renderUpdate(approved(["lab_measurement"]));
  expect(group(html,"added").match(/<li /g)).toHaveLength(1);expect(group(html,"added")).not.toContain("Oral iron");
  expect(group(html,"calculated").match(/<li /g)).toHaveLength(2);
 });
 it("oral-iron-only approval does not fabricate a ferritin update or calculated group",()=>{
  const html=renderUpdate(approved(["medication_status"]));
  expect(group(html,"added").match(/<li /g)).toHaveLength(1);expect(html).toContain("Oral iron · Ongoing");
  expect(html).not.toContain('data-update-group="calculated"');expect(html).not.toContain("New ferritin");expect(html).not.toContain("Ferritin history");
 });
 it("an immutable baseline with no approved addition has no Latest approved update",()=>{
  expect(renderUpdate(baseline)).not.toContain("Latest approved update");expect(renderUpdate(baseline)).not.toContain("<section");
 });
 it("chronology versus care completion is explained inside follow-up Evidence, never on the update card",()=>{
  const state=approved(["lab_measurement","medication_status"]),index=richEvidence(state,true),claim=Object.values(index.claims).find(c=>c.kind==="followup_match")!;
  const evidence=renderToStaticMarkup(createElement(CalculatedClaimView,{claim,index,onOpenFact(){}}));
  expect(evidence).toContain("chronology only, not care completion");expect(evidence).toContain("does not confirm that the later result fulfilled the recommendation");
  for(const id of claim.inputFactIds)expect(evidence).toContain(index.facts[id].source.verifiedExcerpt);
  expect(renderUpdate(state)).not.toContain("care completion");
  const other=Object.values(index.claims).find(c=>c.key==="rich:latest:ferritin")!;
  expect(renderToStaticMarkup(createElement(CalculatedClaimView,{claim:other,index,onOpenFact(){}}))).not.toContain("care completion");
 });
 it("the original non-compact recap preserves its wording and complete existing list",()=>{
  const html=renderUpdate(approved(["lab_measurement","medication_status"]),false);
  expect(html).toContain("What changed");expect(html).toContain("New ferritin measurement added");expect(html).toContain("Oral iron marked Ongoing");
  expect(html).toContain("11 documented measurements across 5 analytes");expect(html).not.toContain('data-update-group=');
 });
});


describe("public terminology preserves the trusted record",()=>{
 it("distinguishes the broader curated baseline from deliberately narrow live extraction",()=>{
  const state=approved(["lab_measurement","medication_status"]),saved=JSON.stringify(state);
  const html=renderToStaticMarkup(createElement(EvidenceProvider,{index:richEvidence(state,true),children:createElement(RichRecord,{state,integrated:true})}));
  expect(html).toContain("Source wording checked");expect(html).not.toContain("Source verified");
  expect(html).toContain("Curated synthetic baseline");expect(html).toContain("Live Add record: ferritin + oral iron only.");
  expect(html).toContain("Synthetic demo record");expect(html).toContain("Fictional patient");
  expect(html).toContain('href="/sources">Explore source documents</a>');
  expect(JSON.stringify(state)).toBe(saved);
 });
 it("changes only the displayed follow-up label, preserving dates, explanation and evidence inputs",()=>{
  const state=approved(["lab_measurement","medication_status"]),index=richEvidence(state,true);
  const claim=Object.values(index.claims).find(c=>c.kind==="followup_match")!,saved=JSON.stringify(claim);
  const html=renderToStaticMarkup(createElement(CalculatedClaimView,{claim,index,onOpenFact(){}}));
  expect(calculationText(claim.text)).toBe("Later ferritin result documented · 25 Sep 2026");
  expect(html).toContain("Later ferritin result documented · 25 Sep 2026");expect(html).not.toContain("Matching follow-up result found");
  expect(html).toContain("not whether the follow-up was on time");expect(html).toContain("chronology only, not care completion");expect(html).toContain("or that care was appropriate");
  for(const id of claim.inputFactIds)expect(html).toContain(index.facts[id].source.verifiedExcerpt);
  expect(claim.text).toBe("Matching follow-up result found · 25 Sep 2026");expect(JSON.stringify(claim)).toBe(saved);
 });
 it("describes rich calculation rules without changing any claim or its original rule",()=>{
  const index=richEvidence(baseline,true),saved=JSON.stringify(index.claims);
  const range=Object.values(index.claims).find(c=>c.key.startsWith("rich:range:"))!;
  const html=renderToStaticMarkup(createElement(CalculatedClaimView,{claim:range,index,onOpenFact(){}}));
  expect(html).toContain("including the endpoints");expect(html).toContain("not normalized or compared across ranges");expect(html).toContain("units are not converted");
  expect(html).toContain("does not assign severity or imply treatment");expect(html).not.toContain("Do not compare");
  expect(calculationExplanation(index.claims["rich:laboratory-overview"])).toContain("All results on that date are retained");
  expect(calculationExplanation(index.claims["rich:latest:ferritin"])).toContain("Each result keeps its original unit and supplied range");
  expect(calculationExplanation({ruleDescription:"Unchanged existing explanation."})).toBe("Unchanged existing explanation.");
  expect(JSON.stringify(index.claims)).toBe(saved);
 });
 it("uses Direct and Calculated while preserving Summary composition and baseline/live attribution",()=>{
  const state=approved(["lab_measurement","medication_status"]),index=richEvidence(state,true);
  const composed=composeRichSummary(state),saved=JSON.stringify(composed);
  const html=renderToStaticMarkup(createElement(EvidenceProvider,{index,children:createElement(RichDoctorSummary,{state})}));
  expect(html).toContain("Calculated ·");expect(html).toContain("Calculated — Sources");expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/Derived|derived ·/);
  expect(html).toContain("Later ferritin result documented · 25 Sep 2026");expect(html.replace(/<[^>]+>/g, "")).toContain("This establishes chronology only.");
  expect(html.replace(/<[^>]+>/g, "")).toContain("Anaphylaxis occurred after amoxicillin. Epinephrine was administered in the emergency department.");
  expect(JSON.stringify(composeRichSummary(state))).toBe(saved);
  const sourceHtml=(id:string)=>renderToStaticMarkup(createElement(SourceFactView,{fact:index.facts[id],index,onOpenDocument(){}}));
  const incident=state.facts.find(f=>f.kind==="documented_incident")!;
  expect(sourceHtml(incident.id)).toContain("Direct");expect(sourceHtml(incident.id)).toContain("Curated synthetic baseline");
  const live=state.facts.find(f=>state.latestUpdate!.approvedFactIds.includes(f.id))!;
  expect(sourceHtml(live.id)).toContain("Added with your approval");expect(sourceHtml(live.id)).not.toContain("Curated synthetic baseline");
 });
});
