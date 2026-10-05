/**
 * Data Model — the single source of truth for shapes. Spec: `spec.md > Data Model`.
 *
 * Evidence type vs review status:
 *  - everything in TrustedState.facts is a SOURCE FACT with review "APPROVED"
 *  - CalculatedClaim is the CALCULATED type and is NEVER persisted
 *  - PROPOSED exists only on pending proposal facts; REJECTED only as UI toggle state
 *  - USER CONFIRMED has no representation in this POC
 */

/** `other`: an added document whose type cannot be established from its own text. */
export type DocumentType = "lab_report" | "prescription" | "consultation_note" | "imaging_report" | "other";

export type DocumentRecord = {
  id: string;
  title: string;
  documentType: DocumentType;
  issuer: string;
  date: string; // ISO
  file: string; // PDF filename
  pageCount: number;
  origin: "seed" | "added";
};

export type SourceRef = {
  documentId: string;
  page: number;
  /** ALWAYS original page text (canonicalised by the verifier), never model output. */
  verifiedExcerpt: string;
};

export type LabMeasurement = {
  id: string;
  kind: "lab_measurement";
  topic: "iron";
  analyte: "ferritin";
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  measuredOn: string;
  source: SourceRef;
  review: "APPROVED";
};

export type ImagingExam = {
  id: string;
  kind: "imaging_exam";
  topic: "imaging";
  examName: string;
  performedOn: string;
  statement: string;
  /** only when the report explicitly says so (verified comparison cue + earlier date) */
  comparesToDocumentId: string | null;
  source: SourceRef;
  review: "APPROVED";
};

export type Observation = LabMeasurement | ImagingExam;

export type MedicationStatus = "Prescribed" | "Current" | "Completed" | "Stopped";

export type MedicationEpisode = { id: string; topic: "iron"; name: string };

export type MedicationStatusEvent = {
  id: string;
  kind: "medication_status";
  episodeId: string;
  status: MedicationStatus;
  documentedOn: string;
  source: SourceRef;
  review: "APPROVED";
};

export type FollowUp = {
  id: string;
  kind: "follow_up";
  topic: "iron" | "imaging";
  recommendation: string;
  intervalText: string | null;
  target: { analyte: "ferritin" } | { examName: string };
  recommendedOn: string;
  source: SourceRef;
  review: "APPROVED";
};

export type SourceFact = Observation | MedicationStatusEvent | FollowUp;

export type LatestUpdate = {
  documentId: string;
  approvedFactIds: string[];
  /** fact ids and calculated-claim keys that are new or changed */
  affected: string[];
  approvedAt: string;
};

export type TrustedState = {
  version: 1;
  patient: { displayName: string };
  seededAt: string;
  documents: DocumentRecord[];
  episodes: MedicationEpisode[];
  facts: SourceFact[];
  latestUpdate: LatestUpdate | null;
};

export type CalculatedClaimKind =
  | "range_status"
  | "changed_since_previous"
  | "previously_outside_range"
  | "followup_match"
  | "followup_no_later_result"
  // record claims (lib/engine/recordClaims.ts): medical counts / "latest" selection, shared by Home and the Summary
  | "series_count"
  | "latest_exam"
  | "latest_status"
  // summary-only, composed in lib/summary/compose.ts
  | "below_range_count";

export type CalculatedClaim = {
  key: string;
  kind: CalculatedClaimKind;
  text: string;
  ruleDescription: string;
  inputFactIds: string[];
};

/** A fact that passed live verification and awaits the patient's review (never persisted as trusted). */
export type ProposedFact =
  | (Omit<LabMeasurement, "review"> & { review: "PROPOSED" })
  | (Omit<MedicationStatusEvent, "review"> & { review: "PROPOSED" });

/**
 * A pending proposal: verified facts from one added document, awaiting the patient's review.
 * Lives only in data/runtime/pending/ (server). Never read by any page; never trusted state.
 */
export type Proposal = {
  proposalId: string;
  document: DocumentRecord; // origin "added"; written to trusted state only on Apply
  facts: ProposedFact[];
  excludedCount: number;
  createdAt: string;
};

/** One line of "What changed" / "This would also update…", always traceable to evidence. */
export type ChangeLine = {
  text: string;
  ref: { type: "fact"; id: string } | { type: "claim"; key: string };
};
