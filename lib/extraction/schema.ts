/**
 * Extraction schema — the ONLY shape the model may answer in. Spec: `spec.md > Extraction Client`.
 * Deliberately narrow: two fact kinds, page + excerpt on every item, and NO confidence field
 * (model confidence never enters the trust path).
 * Dates are plain strings here; the verifier checks them deterministically.
 */
import { z } from "zod";

export const ExtractionSchema = z.object({
  document: z.object({
    documentType: z.string().describe("The kind of document, as it describes itself, e.g. 'Follow-up consultation note'."),
    documentDate: z.string().describe("The document's own date, formatted YYYY-MM-DD."),
    page: z.number().int().min(1).describe("1-based page number where the document date appears."),
    excerpt: z.string().describe("Text copied word for word from that page that contains the document date."),
  }),
  labMeasurements: z
    .array(
      z.object({
        analyteName: z.string().describe("The test name exactly as written, e.g. 'Ferritin'."),
        value: z.number().describe("The numeric result."),
        unit: z.string().describe("The unit exactly as written, e.g. 'μg/L'."),
        referenceRangeText: z
          .string()
          .nullable()
          .describe("The reference range exactly as written next to this result, or null if none is given."),
        measuredOn: z.string().describe("The date the measurement refers to, formatted YYYY-MM-DD."),
        page: z.number().int().min(1).describe("1-based page number of the excerpt."),
        excerpt: z.string().describe("One sentence or line copied word for word from that page that states this result."),
      }),
    )
    .describe("Laboratory measurements explicitly stated in the document."),
  medicationStatements: z
    .array(
      z.object({
        medicationName: z.string().describe("The medication exactly as named, e.g. 'oral iron (ferrous sulfate)'."),
        status: z
          .enum(["prescribed", "current", "completed", "stopped"])
          .describe("The status the document EXPLICITLY states for this medication."),
        page: z.number().int().min(1).describe("1-based page number of the excerpt."),
        excerpt: z.string().describe("One sentence copied word for word from that page that states this status."),
      }),
    )
    .describe("Medication status statements explicitly made in the document."),
});

export type ExtractionOutput = z.infer<typeof ExtractionSchema>;
