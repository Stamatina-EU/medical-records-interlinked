import { z } from "zod";
import type { Proposal } from "@/lib/model/types";
import type { BoundProposal,RichOverlay } from "./model";
const id=z.string().min(1),date=z.iso.date();
const source=z.object({documentId:id,page:z.number().int().positive(),verifiedExcerpt:z.string().min(1)}).strict();
const common={id,source};
const lab={...common,kind:z.literal("lab_measurement"),topic:z.literal("iron"),analyte:z.literal("ferritin"),
 value:z.number().finite(),unit:z.string().min(1),refLow:z.number().finite().nullable(),refHigh:z.number().finite().nullable(),refText:z.string().nullable(),measuredOn:date};
const med={...common,kind:z.literal("medication_status"),episodeId:z.literal("ep-oral-iron"),status:z.enum(["Prescribed","Current","Completed","Stopped"]),documentedOn:date};
const proposed=z.union([z.object({...lab,review:z.literal("PROPOSED")}).strict(),z.object({...med,review:z.literal("PROPOSED")}).strict()]);
const approved=z.union([z.object({...lab,review:z.literal("APPROVED")}).strict(),z.object({...med,review:z.literal("APPROVED")}).strict()]);
const document=z.object({id:z.string().regex(/^doc-\d+$/),title:z.string().min(1),documentType:z.enum(["lab_report","prescription","consultation_note","imaging_report","other"]),
 issuer:z.string(),date,file:z.string().regex(/^doc-\d+\.pdf$/),pageCount:z.number().int().positive(),origin:z.literal("added")}).strict();
const episode=z.object({id:z.literal("ep-oral-iron"),topic:z.literal("iron"),name:z.literal("Oral iron (ferrous sulfate)")}).strict();
const latest=z.object({documentId:id,approvedFactIds:z.array(id),affected:z.array(id),approvedAt:z.iso.datetime()}).strict().nullable();
export const LiveProposalSchema=z.object({proposalId:z.uuid(),document,facts:z.array(proposed).min(1),excludedCount:z.number().int().nonnegative(),createdAt:z.iso.datetime()}).strict();
export const OverlaySchema=z.object({version:z.literal(1),profile:z.literal("rich"),baselineDigest:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().nonnegative(),
 documents:z.array(document),facts:z.array(approved),episodes:z.array(episode),latestUpdate:latest}).strict();
const bound=z.object({profile:z.literal("rich"),baselineDigest:z.string().regex(/^[a-f0-9]{64}$/),proposal:LiveProposalSchema}).strict();
export function parseLiveProposal(input:unknown):Proposal {
 const p=LiveProposalSchema.parse(input);
 if(p.document.file!==p.document.id+".pdf" || new Set(p.facts.map(f=>f.id)).size!==p.facts.length || p.facts.some(f=>f.source.documentId!==p.document.id || f.source.page>p.document.pageCount || !f.id.startsWith(p.document.id+"-"))) throw new Error("Invalid live proposal identities");
 return p;
}
export function parseBoundProposal(input:unknown):BoundProposal {const b=bound.parse(input);return {...b,proposal:parseLiveProposal(b.proposal)};}
export function parseOverlay(input:unknown):RichOverlay {return OverlaySchema.parse(input);}
