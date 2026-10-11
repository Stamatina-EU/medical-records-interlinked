/**
 * Code-owned, read-only synthetic record domain. NOT accepted by Proposal/TrustedState.
 * Live LabMeasurement and ProposedFact deliberately remain ferritin/oral-iron only.
 */
import type { LabMeasurement, SourceFact, TrustedState, SourceRef } from "./types";

export type AdditionalAnalyte = "tsh" | "vitamin_d" | "crp" | "creatinine";
export type AdditionalLabMeasurement = Omit<LabMeasurement, "topic" | "analyte"> & {
  topic: "laboratory";
  analyte: AdditionalAnalyte;
};
export type LaboratoryMeasurement = LabMeasurement | AdditionalLabMeasurement;

export type DocumentedIncident = {
  id: string;
  kind: "documented_incident";
  topic: "incidents";
  statement: string;
  /** Only when the source explicitly supplies an incident date. Never the document date fallback. */
  occurredOn: string | null;
  documentedOn: string;
  source: SourceRef;
  review: "APPROVED";
};
export type RecordSourceFact = SourceFact | AdditionalLabMeasurement | DocumentedIncident;
export type RichSyntheticState = Omit<TrustedState, "facts" | "latestUpdate"> & {
  profile: "rich-synthetic";
  readOnly: true;
  facts: RecordSourceFact[];
  latestUpdate: null;
};
