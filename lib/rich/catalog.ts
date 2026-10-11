import type { LaboratoryMeasurement } from "@/lib/model/rich";

/** Editorial order, declared here. It is NOT ranked by range, magnitude or clinical priority. */
export const ANALYTES = [
  { id: "ferritin", label: "Ferritin" },
  { id: "tsh", label: "TSH" },
  { id: "vitamin_d", label: "Vitamin D (25-OH)" },
  { id: "crp", label: "C-reactive protein" },
  { id: "creatinine", label: "Creatinine" },
] as const satisfies readonly { id: LaboratoryMeasurement["analyte"]; label: string }[];
export function analyteLabel(id: LaboratoryMeasurement["analyte"]): string {
  return ANALYTES.find((a) => a.id === id)!.label;
}
