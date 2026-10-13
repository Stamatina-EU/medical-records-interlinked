import { beforeAll,describe,expect,it,expectTypeOf } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RichSyntheticState,DocumentedIncident,LaboratoryMeasurement } from "@/lib/model/rich";
import type { ProposedFact,TrustedState,ImagingExam } from "@/lib/model/types";
import { parseRichState } from "@/lib/rich/schema";
import { verifyRichState } from "@/lib/rich/verify";
import { laboratoryGroups,richClaims,richFactDate } from "@/lib/rich/derive";
import { richEvidence } from "@/lib/rich/evidence";
import { readRichState } from "@/lib/rich/read";
import { readPdfPages } from "@/lib/extraction/pdfText";
import { verifyExtraction,type Extraction } from "@/lib/extraction/verify";
import { ExtractionSchema } from "@/lib/extraction/schema";
import { factHeadline } from "@/lib/evidence/index";
import { GET } from "@/app/rich/api/documents/[id]/route";
let state:RichSyntheticState,pages:Map<string,string[]>;
beforeAll(async()=>{
 state=parseRichState(JSON.parse(await readFile("data/rich-synthetic/state.json","utf8")));
 pages=new Map(await Promise.all(state.documents.map(async d=>[d.id,await readPdfPages(new Uint8Array(await readFile(path.join("data/rich-synthetic/documents",d.file))))] as [string,string[]])));
});
const clone=()=>structuredClone(state);
const imagingComparison=(s:RichSyntheticState)=>s.facts.find((f):f is ImagingExam=>f.kind==="imaging_exam" && f.comparesToDocumentId!==null)!;
const lab=(s:RichSyntheticState)=>s.facts.find((f):f is LaboratoryMeasurement=>f.kind==="lab_measurement")!;
const incident=(s:RichSyntheticState)=>s.facts.find((f):f is DocumentedIncident=>f.kind==="documented_incident")!;
describe("rich immutable fixture: actual PDFs and deterministic verification",()=>{
 it("verifies all 17 source facts in seven actual documents",()=>{expect(state.facts).toHaveLength(17);expect(state.documents).toHaveLength(7);expect(verifyRichState(state,pages)).toEqual([]);});
 it("has five declared analytes, two dated results each, ten exact measurements",()=>{const groups=laboratoryGroups(state);expect(groups.map(g=>g.id)).toEqual(["ferritin","tsh","vitamin_d","crp","creatinine"]);for(const g of groups)expect(g.measurements).toHaveLength(2);});
 it("contains below, inside and above OWN ranges without judgment coding",()=>{const positions=richClaims(state).filter(c=>c.kind==="range_status").map(c=>c.text.split(" ")[0]);expect(new Set(positions)).toEqual(new Set(["Below","Inside","Above"]));expect(positions.filter(p=>p!=="Inside")).toHaveLength(5);});
 it.each([
  ["analyte",(f:LaboratoryMeasurement)=>{f.analyte="tsh";}],
  ["value",(f:LaboratoryMeasurement)=>{f.value+=1;}],
  ["unit",(f:LaboratoryMeasurement)=>{f.unit="ng/mL";}],
  ["date",(f:LaboratoryMeasurement)=>{f.measuredOn="2025-03-15";}],
  ["lower bound",(f:LaboratoryMeasurement)=>{f.refLow=15;}],
  ["upper bound",(f:LaboratoryMeasurement)=>{f.refHigh=401;}],
  ["range text",(f:LaboratoryMeasurement)=>{f.refText="15–150";}],
  ["page",(f:LaboratoryMeasurement)=>{f.source.page=2;}],
  ["source document",(f:LaboratoryMeasurement)=>{f.source.documentId="missing";}],
  ["excerpt",(f:LaboratoryMeasurement)=>{f.source.verifiedExcerpt="Ferritin is low.";}],
 ] as const)("rejects a corrupted lab %s",(_name,mutate)=>{const s=clone();mutate(lab(s));expect(verifyRichState(s,pages).some(x=>x.factId===lab(s).id)).toBe(true);});
 it("does not accept a positive-looking fragment inside qualified source wording",()=>{
  const s=clone(),f=lab(s),p=new Map(pages);
  p.set(f.source.documentId,p.get(f.source.documentId)!.map(t=>t.replace(f.source.verifiedExcerpt,"Not confirmed: "+f.source.verifiedExcerpt)));
  expect(verifyRichState(s,p).some(x=>x.check.includes("complete source lines"))).toBe(true);
 });
 it.each(["date","pageCount","issuer","title"] as const)("rejects corrupted document %s",key=>{
  const s=clone(),d=s.documents.find(d=>d.id.startsWith("rich-lab"))!;
  if(key==="pageCount") d.pageCount=2;else if(key==="date")d.date="2026-01-26";else d[key]="Unsupported";
  expect(verifyRichState(s,pages).some(x=>x.factId===d.id)).toBe(true);
 });
 it("fails closed for missing PDF or duplicate identities",()=>{const s=clone();s.facts.push(s.facts[0]);expect(verifyRichState(s,new Map()).length).toBeGreaterThan(1);expect(verifyRichState(s,pages).some(x=>x.check.includes("duplicate fact"))).toBe(true);});
 it("retains distinct supported incident date and document date",()=>{const f=incident(state);expect(f.occurredOn).toBe("2025-08-18");expect(f.documentedOn).toBe("2025-08-19");expect(richFactDate(f)).toBe(f.occurredOn);expect(factHeadline(f,{}).value).toBe(f.statement);});
 it.each(["occurredOn","documentedOn","statement"] as const)("rejects an unsupported incident %s",key=>{const s=clone(),f=incident(s);f[key]=key==="statement"?"Amoxicillin caused severe anaphylaxis.":"2025-08-20";expect(verifyRichState(s,pages).some(x=>x.factId===f.id)).toBe(true);});
 it("rejects stronger causal/allergy wording even if a new source contains it",()=>{
  const s=clone(),f=incident(s),p=new Map(pages),old=f.source.verifiedExcerpt;
  f.statement="Amoxicillin caused severe anaphylaxis. Permanent penicillin allergy.";
  f.source.verifiedExcerpt="Incident date: 18 Aug 2025. "+f.statement;
  p.set(f.source.documentId,p.get(f.source.documentId)!.map(t=>t.replace(old,f.source.verifiedExcerpt)));
  expect(verifyRichState(s,p).some(x=>x.factId===f.id)).toBe(true);
 });
 it("does not silently fall back to document date for an undated incident",()=>{
  const f={...incident(state),occurredOn:null};expect(richFactDate(f)).toBeNull();
  const s=clone();incident(s).occurredOn=null;expect(verifyRichState(s,pages).some(x=>x.factId===f.id)).toBe(true);
 });
 it("rejects unknown fact kinds and filename traversal at the rich schema",()=>{
  const s=clone();expect(()=>parseRichState({...s,facts:[{...incident(s),kind:"allergy"}]})).toThrow();
  s.documents[0].file="../seed/state.json";expect(()=>parseRichState(s)).toThrow();
 });
 it("reuses original medication verification rather than inventing incident-related status",()=>{
  const s=clone(),f=s.facts.find(f=>f.kind==="medication_status")!;f.status="Stopped";
  expect(verifyRichState(s,pages).some(x=>x.factId===f.id)).toBe(true);
 });
});
describe("pure longitudinal derivation and evidence",()=>{
 it("sorts by measured dates, with stable declared ordering independent of fixture order",()=>{
  const shuffled={...state,facts:[...state.facts].reverse()};expect(laboratoryGroups(shuffled)).toEqual(laboratoryGroups(state));
  for(const g of laboratoryGroups(state))expect(g.latest[0].measuredOn).toBe("2026-01-27");
 });
 it("retains same-date ties rather than inventing a unique latest measurement",()=>{
  const s=clone(),f=laboratoryGroups(s)[0].latest[0];s.facts.push({...f,id:"same-date-other-lab",value:20,unit:"ng/mL"});
  const g=laboratoryGroups(s)[0];expect(g.latest).toHaveLength(2);expect(g.latest.map(f=>f.unit)).toEqual(["μg/L","ng/mL"]);
 });
 it("range claims refer to exactly one original result and its bounds, including inclusive edges",()=>{
  const s=clone(),f=lab(s);f.value=f.refLow!;
  let claim=richClaims(s).find(c=>c.key==="rich:range:"+f.id)!;expect(claim.text).toContain("Inside");expect(claim.inputFactIds).toEqual([f.id]);
  f.value=f.refHigh!;claim=richClaims(s).find(c=>c.key==="rich:range:"+f.id)!;expect(claim.text).toContain("Inside");
 });
 it("does not calculate a range status when a bound is absent",()=>{const s=clone(),f=lab(s);f.refHigh=null;expect(richClaims(s).some(c=>c.key==="rich:range:"+f.id)).toBe(false);});
 it("keeps units, values and supplied ranges unchanged after deriving",()=>{const before=JSON.stringify(state);richClaims(state);laboratoryGroups(state);richEvidence(state);expect(JSON.stringify(state)).toBe(before);});
 it("overview cites all ten labs; per-analyte latest cites only that analyte; incident has no inference",()=>{
  const claims=richClaims(state),overview=claims.find(c=>c.key==="rich:laboratory-overview")!;
  expect(overview.inputFactIds).toHaveLength(10);
  for(const g of laboratoryGroups(state))expect(new Set(claims.find(c=>c.key==="rich:latest:"+g.id)!.inputFactIds)).toEqual(new Set(g.measurements.map(f=>f.id)));
  expect(claims.some(c=>c.inputFactIds.includes(incident(state).id))).toBe(false);
 });
 it("rich evidence includes every source and routes PDFs to its isolated destination",()=>{const index=richEvidence(state);expect(Object.keys(index.facts)).toHaveLength(17);expect(index.documentUrlBase).toBe("/rich/api/documents");for(const c of Object.values(index.claims))for(const id of c.inputFactIds)expect(index.facts[id]).toBeDefined();});
});
describe("technical live-scope fence and separate default story",()=>{
 it("keeps ProposedFact types ferritin/oral iron only",()=>{
  expectTypeOf<Extract<ProposedFact,{kind:"lab_measurement"}>["analyte"]>().toEqualTypeOf<"ferritin">();
  expectTypeOf<Extract<ProposedFact,{kind:"documented_incident"}>>().toEqualTypeOf<never>();
 });
 it.each(["TSH","Vitamin D (25-OH)","C-reactive protein","Creatinine"])("live verification rejects %s",name=>{
  const text="Date 27 Jan 2026\nRESULTS\n"+name+" on 27 Jan 2026: 3 mg/L (reference range 1–4 mg/L).";
  const payload:Extraction={document:{documentType:"Laboratory report",documentDate:"2026-01-27",page:1,excerpt:"Date 27 Jan 2026"},labMeasurements:[{analyteName:name,value:3,unit:"mg/L",referenceRangeText:"1–4 mg/L",measuredOn:"2026-01-27",page:1,excerpt:text.split("\n").at(-1)!}],medicationStatements:[]};
  const result=verifyExtraction([text],payload,{documentId:"doc-live",episodes:state.episodes});expect(result.status).toBe("unusable");
 });
 it("ignores attempted incident/allergy payload fields and rejects amoxicillin as oral iron",()=>{
  const payload=ExtractionSchema.parse({document:{documentType:"ED note",documentDate:"2025-08-19",page:1,excerpt:"Date 19 Aug 2025"},labMeasurements:[],medicationStatements:[{medicationName:"amoxicillin",status:"stopped",page:1,excerpt:"Amoxicillin was stopped."}],incidentStatements:[incident(state)],allergies:["penicillin"]});
  expect(payload).not.toHaveProperty("incidentStatements");expect(payload).not.toHaveProperty("allergies");
  const result=verifyExtraction(["Date 19 Aug 2025\nINCIDENT\n"+incident(state).statement+"\nAmoxicillin was stopped."],payload,{documentId:"live",episodes:state.episodes});expect(result.status).toBe("unusable");
 });
 it("continues to verify supported ferritin and oral iron even alongside unsupported candidates",()=>{
  const a="Ferritin on 27 Jan 2026: 19.6 μg/L (reference range 15–150 μg/L).",b="The patient continues to take oral iron (ferrous sulfate) once daily.",c="TSH on 27 Jan 2026: 3.2 mIU/L.";
  const text="Date 27 Jan 2026\nRESULTS\n"+a+"\n"+c+"\nMEDICATION HISTORY\n"+b;
  const payload:Extraction={document:{documentType:"Consultation note",documentDate:"2026-01-27",page:1,excerpt:"Date 27 Jan 2026"},labMeasurements:[{analyteName:"Ferritin",value:19.6,unit:"μg/L",referenceRangeText:"15–150 μg/L",measuredOn:"2026-01-27",page:1,excerpt:a},{analyteName:"TSH",value:3.2,unit:"mIU/L",referenceRangeText:null,measuredOn:"2026-01-27",page:1,excerpt:c}],medicationStatements:[{medicationName:"oral iron",status:"current",page:1,excerpt:b}]};
  const result=verifyExtraction([text],payload,{documentId:"live",episodes:state.episodes});expect(result.status).toBe("ok");if(result.status==="ok")expect(result.verified.map(f=>f.kind)).toEqual(["lab_measurement","medication_status"]);
 });
 it("default seed remains the six-document/eight-fact story with only ferritin labs",async()=>{const seed:TrustedState=JSON.parse(await readFile("data/seed/state.json","utf8"));expect(seed.documents).toHaveLength(6);expect(seed.facts).toHaveLength(8);expect(seed).not.toHaveProperty("profile");expect(new Set(seed.facts.filter(f=>f.kind==="lab_measurement").map(f=>f.analyte))).toEqual(new Set(["ferritin"]));});
 it("rich loader is read-only and returns its own profile",async()=>{const loaded=await readRichState();expect(loaded.profile).toBe("rich-synthetic");expect(loaded.readOnly).toBe(true);expect(loaded.latestUpdate).toBeNull();});
 it("serves only known fixture document IDs as real PDF bytes",async()=>{
  const doc=state.documents.find(d=>d.id.startsWith("rich-ed"))!;
  const result=await GET(new Request("http://localhost"),{params:Promise.resolve({id:doc.id})});
  expect(result.status).toBe(200);expect(result.headers.get("Content-Type")).toBe("application/pdf");expect(Buffer.from(await result.arrayBuffer()).subarray(0,5).toString()).toBe("%PDF-");
  const missing=await GET(new Request("http://localhost"),{params:Promise.resolve({id:"../../seed/state.json"})});expect(missing.status).toBe(404);
 });
});

describe("M2 · fixture-only imaging examination date role",()=>{
 it("accepts 12 Mar 2026 as performedOn and preserves the 10 Sep 2025 comparison wording",()=>{
  const s=clone(),f=imagingComparison(s),before=structuredClone(f);
  expect(f.performedOn).toBe("2026-03-12");
  expect(f.source.verifiedExcerpt).toContain("Thyroid ultrasound of 12 Mar 2026 compared with the thyroid ultrasound of 10 Sep 2025.");
  expect(verifyRichState(s,pages)).toEqual([]);
  expect(f).toEqual(before);
 });
 it("rejects 10 Sep 2025 as performedOn even though that comparison date occurs in the verified excerpt",()=>{
  const s=clone(),f=imagingComparison(s),excerpt=f.source.verifiedExcerpt;
  f.performedOn="2025-09-10";
  expect(verifyRichState(s,pages)).toContainEqual({factId:f.id,page:f.source.page,check:"performedOn does not match the examination date source role"});
  expect(f.source.verifiedExcerpt).toBe(excerpt);
 });
 it("rejects an examination-looking fragment inside a differently qualified source line",()=>{
  const s=clone(),f=imagingComparison(s),p=new Map(pages);
  p.set(f.source.documentId,p.get(f.source.documentId)!.map(text=>text.replace(f.source.verifiedExcerpt,"Comparison reference: "+f.source.verifiedExcerpt)));
  expect(verifyRichState(s,p).some(x=>x.factId===f.id && x.check.includes("complete source lines"))).toBe(true);
 });
});