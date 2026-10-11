import { z } from "zod";
import type { RichSyntheticState } from "@/lib/model/rich";
const date = z.iso.date();
const source = z.object({documentId: z.string().min(1), page: z.number().int().positive(), verifiedExcerpt: z.string().min(1)}).strict();
const base = {id: z.string().min(1), source, review: z.literal("APPROVED")};
const labFields = {...base, kind: z.literal("lab_measurement"), value: z.number().finite(), unit: z.string().min(1),
  refLow: z.number().finite().nullable(), refHigh: z.number().finite().nullable(), refText: z.string().nullable(), measuredOn: date};
const lab = z.union([
  z.object({...labFields, topic: z.literal("iron"), analyte: z.literal("ferritin")}).strict(),
  z.object({...labFields, topic: z.literal("laboratory"), analyte: z.enum(["tsh","vitamin_d","crp","creatinine"])}).strict(),
]);
const fact = z.union([
  lab,
  z.object({...base, kind: z.literal("documented_incident"), topic: z.literal("incidents"), statement: z.string().min(1),
    occurredOn: date.nullable(), documentedOn: date}).strict(),
  z.object({...base, kind: z.literal("imaging_exam"), topic: z.literal("imaging"), examName: z.string(),
    performedOn: date, statement: z.string(), comparesToDocumentId: z.string().nullable()}).strict(),
  z.object({...base, kind: z.literal("medication_status"), episodeId: z.string(), status: z.enum(["Prescribed","Current","Completed","Stopped"]), documentedOn: date}).strict(),
  z.object({...base, kind: z.literal("follow_up"), topic: z.enum(["iron","imaging"]), recommendation: z.string(),
    intervalText: z.string().nullable(), target: z.union([z.object({analyte:z.literal("ferritin")}).strict(),z.object({examName:z.string()}).strict()]), recommendedOn: date}).strict(),
]);
export const RichStateSchema = z.object({
  version: z.literal(1), profile: z.literal("rich-synthetic"), readOnly: z.literal(true),
  patient: z.object({displayName:z.string()}).strict(), seededAt:z.iso.datetime(), latestUpdate:z.null(),
  documents: z.array(z.object({id:z.string().min(1),title:z.string().min(1),documentType:z.enum(["lab_report","prescription","consultation_note","imaging_report","other"]),
    issuer:z.string().min(1),date,file:z.string().regex(/^[a-zA-Z0-9_-]+\.pdf$/),pageCount:z.number().int().positive(),origin:z.literal("seed")}).strict()),
  episodes:z.array(z.object({id:z.string(),topic:z.literal("iron"),name:z.string()}).strict()),
  facts:z.array(fact),
}).strict();
export function parseRichState(input: unknown): RichSyntheticState {
  return RichStateSchema.parse(input);
}
