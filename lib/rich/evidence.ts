import type { RecordState } from "@/lib/demo/model";
import { recordCalculations } from "@/lib/demo/record";
import type { SourceFact, TrustedState } from "@/lib/model/types";
import { derive } from "@/lib/engine/derive";
import { recordClaims } from "@/lib/engine/recordClaims";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { richClaims } from "./derive";
export function richEvidence(state: RecordState, integrated=false) {
  const originalKinds:SourceFact[]=state.facts.filter((f):f is SourceFact=>
    f.kind!=="documented_incident" && (f.kind!=="lab_measurement" || f.analyte==="ferritin"));
  const projection:TrustedState={version:1,patient:state.patient,seededAt:state.seededAt,documents:state.documents,episodes:state.episodes,facts:originalKinds,latestUpdate:state.latestUpdate};
  return {...buildEvidenceIndex(state,integrated ? recordCalculations(state) : [...derive(projection),...recordClaims(projection),...richClaims(state)]),
    profile:"rich-synthetic" as const,routeBase:integrated ? "" : "/rich",documentUrlBase:integrated ? "/api/documents" : "/rich/api/documents"};
}
