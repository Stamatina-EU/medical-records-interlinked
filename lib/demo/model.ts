import type { RichSyntheticState } from "@/lib/model/rich";
import type { ProposedFact,LatestUpdate,DocumentRecord,MedicationEpisode } from "@/lib/model/types";
export type ApprovedLiveFact=Omit<Extract<ProposedFact,{kind:"lab_measurement"}>,"review"> & {review:"APPROVED"}
  | Omit<Extract<ProposedFact,{kind:"medication_status"}>,"review"> & {review:"APPROVED"};
export type RecordState=Omit<RichSyntheticState,"readOnly"|"latestUpdate"> & {readOnly:boolean;latestUpdate:LatestUpdate|null};
export type RichOverlay={version:1;profile:"rich";baselineDigest:string;revision:number;documents:DocumentRecord[];
  facts:ApprovedLiveFact[];episodes:MedicationEpisode[];latestUpdate:LatestUpdate|null};
export type BoundProposal={profile:"rich";baselineDigest:string;proposal:import("@/lib/model/types").Proposal};
