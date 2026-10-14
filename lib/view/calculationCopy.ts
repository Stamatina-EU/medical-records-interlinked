/** Presentation copy only. Never changes claims, inputs, calculations or source wording. */
import type { CalculatedClaim } from "@/lib/model/types";

export function calculationText(text: string): string {
  return text.replace(/^Matching follow-up result found(?= ·|\.|$)/, "Later ferritin result documented");
}

const EXPLANATIONS: Record<string, string> = {
  "Count approved laboratory source facts; group by exact analyte id in the declared order Ferritin, TSH, Vitamin D (25-OH), C-reactive protein, Creatinine. Latest means the greatest explicitly documented measured date within each analyte. Same-date ties are retained. No clinical ranking, unit conversion or cross-laboratory normalization.":
    "Approved laboratory results are counted and grouped by analyte in a fixed order: Ferritin, TSH, Vitamin D (25-OH), C-reactive protein and Creatinine. Latest means the most recent explicitly documented measurement date for each analyte. All results on that date are retained. This ordering does not indicate clinical priority. Units are not converted and results from different laboratories are not normalized.",
  "Group only this exact analyte; count its approved source facts and select the greatest measured date. All results on that date are retained. Units and supplied ranges stay attached to each original result. No normalization.":
    "Approved results for this analyte are counted and ordered by measurement date. Latest means the most recent date; all results on that date are retained. Each result keeps its original unit and supplied range. Results are not normalized across laboratories.",
  "Compare only this exact numerical result with its own supplied lower and upper bounds, inclusive. Do not compare ranges between laboratories, convert units, assign severity or infer treatment.":
    "This result is compared only with its own supplied lower and upper bounds, including the endpoints. Results from different laboratories are not normalized or compared across ranges, and units are not converted. This comparison does not assign severity or imply treatment.",
};

export function calculationExplanation(claim: Pick<CalculatedClaim, "ruleDescription">): string {
  return EXPLANATIONS[claim.ruleDescription] ?? claim.ruleDescription;
}
