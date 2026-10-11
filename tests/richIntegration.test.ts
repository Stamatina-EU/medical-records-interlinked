import { afterAll,beforeEach,describe,expect,it,vi } from "vitest";
import { readFile,rm,mkdir,writeFile,readdir,access } from "node:fs/promises";
import path from "node:path";
import { randomUUID,createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/demo/paths",async()=>{
 const {mkdtempSync}=await import("node:fs"),os=await import("node:os"),p=await import("node:path");
 const root=mkdtempSync(p.join(os.tmpdir(),"mri-rich-integration-"));
 const actual=await vi.importActual<typeof import("@/lib/demo/paths")>("@/lib/demo/paths");
 return {...actual,RICH_RUNTIME_DIR:root,RICH_OVERLAY:p.join(root,"state.json"),RICH_PENDING:p.join(root,"pending"),RICH_UPLOADS:p.join(root,"documents"),checkedRichPath:(target:string)=>actual.checkedRichPath(target,root)};
});
const navigationState=vi.hoisted(()=>({pathname:"/"}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh(){}}),usePathname:()=>navigationState.pathname}));
import { RICH_RUNTIME_DIR,RICH_OVERLAY,RICH_PENDING,RICH_UPLOADS,checkedRichPath } from "@/lib/demo/paths";
import { readRichRecord,readBaseline,emptyOverlay,composeRecord,writeOverlay } from "@/lib/demo/store";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import type { Extraction } from "@/lib/extraction/verify";
import { liveContext,dedupeLive,previewRecord,recordCalculations } from "@/lib/demo/record";
import { saveRichProposal,loadRichProposal } from "@/lib/demo/proposals";
import { POST as applyRoute } from "@/app/api/records/apply/route";
import { POST as cancelRoute } from "@/app/api/records/cancel/route";
import { GET as documentRoute } from "@/app/api/documents/[id]/route";
import { composeRichSummary } from "@/lib/demo/summary";
import { parseLiveProposal,parseOverlay } from "@/lib/demo/schema";
import { resetRichRecord } from "@/lib/demo/reset";
import { laboratoryGroups } from "@/lib/rich/derive";
import { richEvidence } from "@/lib/rich/evidence";
import { approvalProblem,APPROVAL_PROBLEM_TEXT } from "@/lib/view/approvalOutcome";
import { demoProfile } from "@/lib/demo/profile";
import { Review } from "@/components/add-record/AddRecord";
import SourceFactView from "@/components/evidence/SourceFactView";
import AppNav from "@/components/shell/AppNav";
const extraction:Extraction={document:{documentType:"Follow-up consultation note",documentDate:"2026-09-25",page:1,excerpt:"Date of consultation 25 Sep 2026"},
 labMeasurements:[{analyteName:"Ferritin",value:32,unit:"μg/L",referenceRangeText:"15–150 μg/L",measuredOn:"2026-09-25",page:2,excerpt:"Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150 μg/L)."}],
 medicationStatements:[{medicationName:"oral iron (ferrous sulfate)",status:"current",page:1,excerpt:"The patient continues to take oral iron (ferrous sulfate) once daily."}]};
const pdf=await readFile("demo-files/follow-up-consultation-2026-09-25.pdf");
function request(ids:unknown,id:string){return new Request("http://localhost/api/records/apply",{method:"POST",headers:{"Content-Type":"application/json",origin:"http://localhost"},body:JSON.stringify({proposalId:id,approvedFactIds:ids})});}
async function propose(payload=extraction){const {record,digest}=await readRichRecord();const out=await runExtractionPipeline(new Uint8Array(pdf),liveContext(record),{extract:async()=>({status:"ok",extraction:payload,model:"deterministic-test-stub"}),newProposalId:randomUUID,now:()=>"2026-10-11T12:00:00.000Z",dedupeFacts:dedupeLive});if(out.status==="proposal")await saveRichProposal(out.proposal,new Uint8Array(pdf),digest);return out;}
async function proposal(){const out=await propose();if(out.status!=="proposal")throw new Error(out.status);return out.proposal;}
beforeEach(async()=>{vi.stubEnv("MRI_DEMO_PROFILE","rich");await resetRichRecord();});
afterAll(async()=>{vi.unstubAllEnvs();await rm(checkedRichPath(RICH_RUNTIME_DIR),{recursive:true,force:true});});
describe("rich default approval integration against real PDF verification",()=>{
 it("Record navigation returns to its profile root from other destinations on desktop and mobile",()=>{
  for(const [profile,pathname,root] of [["rich","/summary","/"],["rich","/sources","/"],["rich","/history","/"],["rich","/laboratory","/"],["legacy","/summary","/"],["rich","/rich/summary","/rich"]] as const){
   navigationState.pathname=pathname;
   const html=renderToStaticMarkup(createElement(AppNav,{patientName:"Synthetic patient",demoProfile:profile}));
   const recordLinks=(html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g)??[]).filter(link=>link.includes(">Record</span>"));
   expect(recordLinks).toHaveLength(2);for(const link of recordLinks)expect(link).toContain(`href="${root}"`);
  }
  navigationState.pathname="/";
 });
 it("starts at 7 documents, 17 facts, 10 measurements, 5 analytes",async()=>{const {record,overlay}=await readRichRecord();expect([record.documents.length,record.facts.length,laboratoryGroups(record).reduce((n,g)=>n+g.measurements.length,0),laboratoryGroups(record).length]).toEqual([7,17,10,5]);expect(overlay.facts).toEqual([]);});
 it("full approval reaches the exact 8/19/11/5 state and preserves every baseline fact",async()=>{
  const before=await readRichRecord(),p=await proposal();expect((await applyRoute(request(p.facts.map(f=>f.id),p.proposalId))).status).toBe(200);
  const {record,overlay}=await readRichRecord();expect([record.documents.length,record.facts.length,record.facts.filter(f=>f.kind==="lab_measurement").length,laboratoryGroups(record).length]).toEqual([8,19,11,5]);
  for(const f of before.baseline.facts)expect(record.facts.find(x=>x.id===f.id)).toEqual(f);
  expect(laboratoryGroups(record)[0].latest[0]).toMatchObject({value:32,unit:"μg/L",measuredOn:"2026-09-25"});
  expect(overlay.facts.find(f=>f.kind==="medication_status")).toMatchObject({status:"Current"});
  expect(recordCalculations(record).some(c=>c.kind==="followup_match")).toBe(true);expect(overlay.facts).toHaveLength(2);expect(overlay.documents).toHaveLength(1);
  expect(record.latestUpdate?.affected).toEqual(expect.arrayContaining(["rich:laboratory-overview","rich:latest:ferritin","followup-match:fu-ferritin-2026-02-03"]));
 });
 it.each(["lab_measurement","medication_status"] as const)("supports %s-only approval",async kind=>{
  const p=await proposal(),f=p.facts.find(f=>f.kind===kind)!;await applyRoute(request([f.id],p.proposalId));const {record,overlay}=await readRichRecord();
  expect(overlay.facts).toHaveLength(1);expect(overlay.facts[0].kind).toBe(kind);expect(record.facts).toHaveLength(18);
  expect(recordCalculations(record).some(c=>c.kind==="followup_match")).toBe(kind==="lab_measurement");
 });
 it("exclude/re-include preview recomputes the count, latest selection and follow-up without writing",async()=>{
  const {record}=await readRichRecord(),p=await proposal(),lab=p.facts.find(f=>f.kind==="lab_measurement")!;
  const all=previewRecord(record,p,p.facts.map(f=>f.id)),excluded=previewRecord(record,p,p.facts.filter(f=>f.id!==lab.id).map(f=>f.id));
  expect(all.some(l=>l.text.includes("Matching follow-up"))).toBe(true);expect(excluded.some(l=>l.text.includes("Matching follow-up"))).toBe(false);expect(excluded.some(l=>l.text.includes("11 documented"))).toBe(false);
  expect(previewRecord(record,p,p.facts.map(f=>f.id))).toEqual(all);expect((await readRichRecord()).overlay.facts).toEqual([]);
 });
 it("renders the same rich review consequences after excluding and re-including ferritin",async()=>{
  const {record}=await readRichRecord(),p=await proposal(),lab=p.facts.find(f=>f.kind==="lab_measurement")!;
  const render=(rejected:Set<string>)=>renderToStaticMarkup(createElement(Review,{phase:{kind:"review",state:record,proposal:p,rejected},setPhase(){},onApply(){},onCancel(){}}));
  expect(render(new Set())).toContain("11 documented measurements across 5 analytes");expect(render(new Set([lab.id]))).not.toContain("Matching follow-up result found");expect(render(new Set())).toContain("Add 2 facts to my record");
 });
 it("cancel deletes only the rich pending proposal and changes no approved record",async()=>{const p=await proposal(),before=await readFile(RICH_OVERLAY);await cancelRoute(new Request("http://localhost/api/records/cancel",{method:"POST",headers:{"Content-Type":"application/json",origin:"http://localhost"},body:JSON.stringify({proposalId:p.proposalId})}));expect(await loadRichProposal(p.proposalId)).toBeNull();expect(await readFile(RICH_OVERLAY)).toEqual(before);});
 it("reject-all, unknown ids, duplicate ids and browser fact objects cannot apply",async()=>{const p=await proposal();for(const ids of [[],["forged"],[p.facts[0].id,p.facts[0].id],[{id:p.facts[0].id,value:999}]])expect((await applyRoute(request(ids,p.proposalId))).status).toBe(400);expect((await readRichRecord()).overlay.facts).toEqual([]);});
 it("duplicate upload returns no_changes and leaves persisted state byte-identical",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));const before=await readFile(RICH_OVERLAY);expect((await propose()).status).toBe("no_changes");expect(await readFile(RICH_OVERLAY)).toEqual(before);});
 it("a new store-module instance reads approvals from disk after restart",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));vi.resetModules();const fresh=await import("@/lib/demo/store");expect((await fresh.readRichRecord()).record.facts).toHaveLength(19);});
 it("concurrent distinct proposals receive different final identities and preserve both PDFs",async()=>{
  const a=await proposal(),bytes=new Uint8Array(await readFile('tests/fixtures/second-follow-up-2026-10-02.pdf'));
  const payload:Extraction={document:{documentType:'Follow-up consultation note',documentDate:'2026-10-02',page:1,excerpt:'Date of consultation 2 Oct 2026'},labMeasurements:[{analyteName:'Ferritin',value:41,unit:'μg/L',referenceRangeText:'15–150 μg/L',measuredOn:'2026-10-02',page:1,excerpt:'Ferritin on 2 Oct 2026: 41 μg/L (reference range 15–150 μg/L).'}],medicationStatements:[{medicationName:'oral iron (ferrous sulfate)',status:'stopped',page:1,excerpt:'Oral iron (ferrous sulfate) was stopped.'}]};
  const {record,digest}=await readRichRecord(),out=await runExtractionPipeline(bytes,liveContext(record),{extract:async()=>({status:'ok',extraction:payload,model:'stub'}),newProposalId:randomUUID,now:()=>"2026-10-11T12:00:00.000Z",dedupeFacts:dedupeLive});if(out.status!=='proposal')throw new Error(out.status);const b=out.proposal;await saveRichProposal(b,bytes,digest);
  expect(a.document.id).toBe(b.document.id);const responses=await Promise.all([applyRoute(request(a.facts.map(f=>f.id),a.proposalId)),applyRoute(request(b.facts.map(f=>f.id),b.proposalId))]);expect(responses.map(r=>r.status)).toEqual([200,200]);
  const after=await readRichRecord();expect(after.record.facts).toHaveLength(21);expect(new Set(after.overlay.documents.map(d=>d.id)).size).toBe(2);
  for(const [date,original] of [['2026-09-25',new Uint8Array(pdf)],['2026-10-02',bytes]] as const){const doc=after.overlay.documents.find(d=>d.date===date)!;expect(new Uint8Array(await readFile(path.join(RICH_UPLOADS,doc.file)))).toEqual(original);for(const f of after.overlay.facts.filter(f=>f.source.documentId===doc.id))expect(f.id.startsWith(doc.id+'-')).toBe(true);}
 });
 it("rejects numerically corrupted approved overlay facts against their actual PDF",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));const raw=JSON.parse(await readFile(RICH_OVERLAY,'utf8'));raw.facts.find((f:any)=>f.kind==='lab_measurement').value=999;await writeFile(RICH_OVERLAY,JSON.stringify(raw));await expect(readRichRecord()).rejects.toThrow('source verification');});
 it("concurrent approvals of duplicate proposals are duplicate-safe",async()=>{const a=await proposal(),b=await proposal();const results=await Promise.all([applyRoute(request(a.facts.map(f=>f.id),a.proposalId)),applyRoute(request(b.facts.map(f=>f.id),b.proposalId))]);expect(results.map(r=>r.status)).toEqual([200,200]);expect((await readRichRecord()).record.facts).toHaveLength(19);expect((await readdir(RICH_UPLOADS)).filter(n=>n.endsWith('.pdf'))).toHaveLength(1);});
 it("a lost approval response retains uncertainty and retry cannot duplicate an applied document",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));expect(approvalProblem(null,false)).toBe("uncertain");const retry=await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));expect(approvalProblem(retry.status,true)).toBe("gone-after-uncertain");expect(APPROVAL_PROBLEM_TEXT['gone-after-uncertain']).toContain("may have completed");expect((await readRichRecord()).record.facts).toHaveLength(19);});
 it("rejects a bound proposal from a different baseline revision",async()=>{const p=await proposal();const target=path.join(RICH_PENDING,p.proposalId,"proposal.json"),raw=JSON.parse(await readFile(target,"utf8"));raw.baselineDigest='a'.repeat(64);await writeFile(target,JSON.stringify(raw));expect((await applyRoute(request(p.facts.map(f=>f.id),p.proposalId))).status).toBe(409);expect((await readRichRecord()).record.facts).toHaveLength(17);});
 it("rejects a legacy/unbound pending proposal",async()=>{const p=await proposal();await writeFile(path.join(RICH_PENDING,p.proposalId,"proposal.json"),JSON.stringify(p));expect((await applyRoute(request(p.facts.map(f=>f.id),p.proposalId))).status).toBe(404);});
 it("rejects unsupported extra types or forged ferritin values at Apply",async()=>{const p=await proposal(),target=path.join(RICH_PENDING,p.proposalId,"proposal.json"),raw=JSON.parse(await readFile(target,"utf8"));raw.proposal.facts[0].value=999;await writeFile(target,JSON.stringify(raw));expect((await applyRoute(request([p.facts[0].id],p.proposalId))).status).toBe(400);expect((await readRichRecord()).record.facts).toHaveLength(17);});
 it("serves both immutable and approved source PDFs, rejects unknown/traversal IDs",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));for(const id of ['rich-ed-2025-08-19','doc-07']){const r=await documentRoute(new Request('http://localhost'),{params:Promise.resolve({id})});expect(r.status).toBe(200);expect(r.headers.get('Content-Type')).toBe('application/pdf');expect(Buffer.from(await r.arrayBuffer()).subarray(0,5).toString()).toBe('%PDF-');}expect((await documentRoute(new Request('http://localhost'),{params:Promise.resolve({id:'../../seed/state.json'})})).status).toBe(404);});
 it("all Derived inputs resolve, overview has eleven inputs after approval",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));const index=richEvidence((await readRichRecord()).record,true);expect(index.claims['rich:laboratory-overview'].inputFactIds).toHaveLength(11);for(const c of Object.values(index.claims))for(const id of c.inputFactIds)expect(index.facts[id]).toBeDefined();expect(index.documentUrlBase).toBe('/api/documents');expect(index.routeBase).toBe('');});
 it("Summary covers all five latest values, original ranges, every category and exact incident/date wording",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));const {record}=await readRichRecord(),summary=composeRichSummary(record),text=summary.sections.flatMap(s=>s.statements).map(s=>s.text).join('\n');
  for(const g of laboratoryGroups(record))for(const f of g.latest){expect(text).toContain(`${g.label} — ${f.value} ${f.unit}`);expect(text).toContain(`supplied range ${f.refText} ${f.unit}`);}
  expect(text).toContain('Ongoing');expect(text).toContain('Thyroid ultrasound');expect(text).toContain('Repeat ferritin in 3 months.');expect(text).toContain('Anaphylaxis occurred after amoxicillin. Epinephrine was administered in the emergency department.');expect(text).toContain('Incident date 18 Aug 2025 · document date 19 Aug 2025.');expect(text).not.toMatch(/allergy|contraindication|amoxicillin caused|overdue/i);
  const index=richEvidence(record,true);for(const s of summary.sections)for(const st of s.statements)for(const r of st.refs){expect(r.type==='fact'?index.facts[r.id]:index.claims[r.key]).toBeDefined();expect(summary.sourceNumbers[r.type==='fact'?'fact:'+r.id:'claim:'+r.key].length).toBeGreaterThan(0);}expect(summary.sources).toHaveLength(8);
 });
 it("Evidence attributes live additions to patient approval and baseline facts to the curated fixture",async()=>{const p=await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));const index=richEvidence((await readRichRecord()).record,true);for(const f of Object.values(index.facts)){const html=renderToStaticMarkup(createElement(SourceFactView,{fact:f,index,onOpenDocument(){}}));expect(html).toContain(index.documents[f.source.documentId].origin==='added'?'Added with your approval':'Code-owned synthetic fixture');if(index.documents[f.source.documentId].origin==='added')expect(html).not.toContain('Code-owned synthetic fixture');}});
 it("reset clears rich additions, pending and uploads but preserves an unrelated legacy runtime and both baselines",async()=>{const seed=await readFile('data/seed/state.json'),rich=await readFile('data/rich-synthetic/state.json');const outside=path.join(path.dirname(RICH_RUNTIME_DIR),'legacy-marker-'+randomUUID());await writeFile(outside,'legacy');try{const p=await proposal();await proposal();await applyRoute(request(p.facts.map(f=>f.id),p.proposalId));expect((await readdir(RICH_PENDING)).length).toBeGreaterThan(0);await resetRichRecord();expect((await readRichRecord()).record.facts).toHaveLength(17);expect(await readFile(outside,'utf8')).toBe('legacy');expect(await readFile('data/seed/state.json')).toEqual(seed);expect(await readFile('data/rich-synthetic/state.json')).toEqual(rich);await expect(access(RICH_UPLOADS)).rejects.toThrow();await expect(access(RICH_PENDING)).rejects.toThrow();expect(await readdir(RICH_RUNTIME_DIR)).toEqual(['state.json']);}finally{await rm(outside);}});
 it("runtime overlay cannot contain additional analytes, incidents or an APPROVED proposal",async()=>{const p=await proposal();for(const bad of [{...p.facts[0],analyte:'tsh'},{...p.facts[0],kind:'documented_incident'},{...p.facts[0],review:'APPROVED'}])expect(()=>parseLiveProposal({...p,facts:[bad]})).toThrow();const {digest}=await readBaseline();expect(()=>parseOverlay({...emptyOverlay(digest),facts:[{kind:'documented_incident'}]})).toThrow();});
 it("rejects corrupt overlay shape/revision instead of silently resetting",async()=>{const {overlay}=await readRichRecord();await writeFile(RICH_OVERLAY,JSON.stringify({...overlay,baselineDigest:'b'.repeat(64)}));await expect(readRichRecord()).rejects.toThrow('baseline revision');});
 it("profile is server-owned, rich by default, with explicit legacy fallback",()=>{vi.stubEnv('MRI_DEMO_PROFILE',undefined);expect(demoProfile()).toBe('rich');vi.stubEnv('MRI_DEMO_PROFILE','legacy');expect(demoProfile()).toBe('legacy');vi.stubEnv('MRI_DEMO_PROFILE','invalid');expect(()=>demoProfile()).toThrow();});
 it("never drops distinct own ranges or normalizes different literal units as duplicates",async()=>{const p=await proposal(),lab=p.facts.find(f=>f.kind==='lab_measurement')!;const approved={...lab,review:'APPROVED' as const};if(lab.kind!=='lab_measurement')throw new Error();expect(dedupeLive([approved],[{...lab,refLow:20,refText:'20–150'}]).fresh).toHaveLength(1);expect(dedupeLive([approved],[{...lab,unit:'ng/mL'}]).fresh).toHaveLength(1);expect(dedupeLive([approved],[lab]).fresh).toHaveLength(0);});
});
