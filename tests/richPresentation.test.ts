import { describe,expect,it,vi,afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { parseRichState } from "@/lib/rich/schema";
import { richEvidence } from "@/lib/rich/evidence";
const navigation=vi.hoisted(()=>({path:"/"}));
vi.mock("next/navigation",()=>({usePathname:()=>navigation.path,useRouter:()=>({refresh(){}})}));
import AppNav from "@/components/shell/AppNav";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import LaboratoryRecord from "@/components/rich/LaboratoryRecord";
import RichRecord from "@/components/rich/RichRecord";
import SourceCollection from "@/components/sources/SourceCollection";
import SourceFactView from "@/components/evidence/SourceFactView";
import DocumentViewerModal from "@/components/evidence/DocumentViewerModal";
import RichSummaryScopePage from "@/app/rich/summary/page";
import * as richDocumentRoute from "@/app/rich/api/documents/[id]/route";
const state=parseRichState(JSON.parse(readFileSync("data/rich-synthetic/state.json","utf8")));
const index=richEvidence(state);
const render=(component:React.ReactNode)=>renderToStaticMarkup(createElement(EvidenceProvider,{index,children:component}));
afterEach(()=>{navigation.path="/";});
describe("rich presentation boundaries",()=>{
 it.each(["/rich","/rich/history","/rich/laboratory","/rich/sources","/rich/summary"])("%s keeps all navigation inside the rich profile and has no mutation action",path=>{
  navigation.path=path;
  const html=renderToStaticMarkup(createElement(AppNav,{patientName:state.patient.displayName}));
  for(const href of ["/rich","/rich/history","/rich/sources","/rich/summary"])expect(html).toContain(`href="${href}"`);
  expect(html).not.toContain("Add record");expect(html).toContain("Read-only rich synthetic demo");
 });
 it("default navigation still targets original destinations and keeps Add record",()=>{
  navigation.path="/sources";
  const html=renderToStaticMarkup(createElement(AppNav,{patientName:"Laurence Mercer"}));
  expect(html).toContain('href="/history/iron"');expect(html).toContain('href="/sources"');expect(html).toContain('href="/summary"');
  expect(html).toContain("Add record");expect(html).not.toContain('href="/rich');
 });
 it("shows only five compact latest measurements on Record and exact incident wording",()=>{
  const html=render(createElement(RichRecord,{state}));
  for(const value of ["19.6","3.2","24","3.1","0.92"])expect(html).toContain(`<strong>${value}</strong>`);
  expect(html).not.toContain("<strong>11</strong>");
  expect(html).toContain("Anaphylaxis occurred after amoxicillin.");expect(html).toContain("Incident date 18 Aug 2025");
  expect(html).toContain("10 measurements");expect(html).toContain('href="/rich/laboratory"');
  expect(html).not.toMatch(/permanent allergy|contraindication|health score|drug-class/i);
 });
 it("sources links describe actual laboratory, imaging, medication and incident destinations",()=>{
  const html=render(createElement(SourceCollection,{documents:state.documents,facts:state.facts}));
  for(const text of ["Laboratory measurements","Medication statements","Documented incident","Imaging"])expect(html).toContain(text);
  expect(html).toContain('href="/rich/laboratory"');expect(html).toContain('href="/rich/history#incidents"');
  expect(html).not.toContain('href="/history/');
 });
 it("incident evidence shows separate dates, exact excerpt and curated fixture attribution",()=>{
  const fact=state.facts.find(f=>f.kind==="documented_incident")!;
  const html=renderToStaticMarkup(createElement(SourceFactView,{fact,index,onOpenDocument(){}}));
  expect(html).toContain("18 Aug 2025");expect(html).toContain("19 Aug 2025");expect(html).toContain("Exact source wording");expect(html).toContain("Curated synthetic baseline");
 });
 it("uses scoped PDF endpoints without changing the default viewer endpoint",()=>{
  const props={document:state.documents[0],page:1,onClose(){}};
  const original=renderToStaticMarkup(createElement(DocumentViewerModal,props));
  const rich=renderToStaticMarkup(createElement(DocumentViewerModal,{...props,documentUrlBase:index.documentUrlBase}));
  expect(original).toContain(`src="/api/documents/${props.document.id}#page=1"`);
  expect(rich).toContain(`src="/rich/api/documents/${props.document.id}#page=1"`);
 });
 it("retained rich Summary study links to the completed default composed-record Summary",async()=>{
  const html=renderToStaticMarkup(await RichSummaryScopePage());
  expect(html).toContain("retained read-only design study");
  expect(html).toContain("does not include patient-approved live additions");
  expect(html).toContain("completed composed-record Doctor Summary");
  expect(html).toContain('href="/summary">Open the completed Doctor Summary');
  expect(html).not.toContain("has not been implemented");
  expect(html).not.toContain("six-document hackathon demo");
  expect(html).not.toContain("Current documented picture");
 });
 it("renders dense calculation labels as correctly encoded text",()=>{
  const html=render(createElement(LaboratoryRecord,{state}));
  expect(html).toContain("Calculated \u00b7 2 results \u00b7 latest dated");
  expect(html).not.toContain("\u00c2\u00b7");
 });
 it("rich documents route exports no write methods",()=>{
  for(const method of ["POST","PUT","PATCH","DELETE"])expect(richDocumentRoute).not.toHaveProperty(method);
 });
});
