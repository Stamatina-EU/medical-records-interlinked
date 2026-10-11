import type { LaboratoryMeasurement, RecordSourceFact, RichSyntheticState } from "@/lib/model/rich";
import type { CalculatedClaim } from "@/lib/model/types";
import { ANALYTES, analyteLabel } from "./catalog";
import { formatDate } from "@/lib/text/dates";
export function laboratoryGroups(state: Pick<RichSyntheticState,"facts">) {
  return ANALYTES.map(analyte=>{
    const measurements=state.facts.filter((f):f is LaboratoryMeasurement=>f.kind==="lab_measurement" && f.analyte===analyte.id)
      .sort((a,b)=>b.measuredOn.localeCompare(a.measuredOn)||a.id.localeCompare(b.id));
    // Preserve multiple same-date results; no arbitrary unique "latest" if a tie exists.
    const latest=measurements.filter(f=>f.measuredOn===measurements[0]?.measuredOn);
    return {...analyte,measurements,latest};
  }).filter(g=>g.measurements.length);
}
export function richClaims(state:Pick<RichSyntheticState,"facts">):CalculatedClaim[] {
  const groups=laboratoryGroups(state), labs=groups.flatMap(g=>g.measurements);
  const claims:CalculatedClaim[]=[{
    key:"rich:laboratory-overview",kind:"series_count",
    text:`${labs.length} documented measurements across ${groups.length} analytes`,
    ruleDescription:"Count approved laboratory source facts; group by exact analyte id in the declared order Ferritin, TSH, Vitamin D (25-OH), C-reactive protein, Creatinine. Latest means the greatest explicitly documented measured date within each analyte. Same-date ties are retained. No clinical ranking, unit conversion or cross-laboratory normalization.",
    inputFactIds:labs.map(f=>f.id),
  }];
  for(const group of groups) {
    claims.push({key:`rich:latest:${group.id}`,kind:"series_count",text:`${group.measurements.length} ${group.label} results · latest documented date ${formatDate(group.latest[0].measuredOn)}`,
      ruleDescription:"Group only this exact analyte; count its approved source facts and select the greatest measured date. All results on that date are retained. Units and supplied ranges stay attached to each original result. No normalization.",inputFactIds:group.measurements.map(f=>f.id)});
    for(const f of group.measurements) {
      if(f.refLow===null||f.refHigh===null) continue;
      const position=f.value<f.refLow?"Below":f.value>f.refHigh?"Above":"Inside";
      claims.push({key:`rich:range:${f.id}`,kind:"range_status",text:`${position} this result's supplied laboratory range`,
        ruleDescription:"Compare only this exact numerical result with its own supplied lower and upper bounds, inclusive. Do not compare ranges between laboratories, convert units, assign severity or infer treatment.",
        inputFactIds:[f.id]});
    }
  }
  return claims;
}
export function richFactDate(f:RecordSourceFact):string|null {
  switch(f.kind) {
    case "lab_measurement":return f.measuredOn;
    case "imaging_exam":return f.performedOn;
    case "medication_status":return f.documentedOn;
    case "follow_up":return f.recommendedOn;
    case "documented_incident":return f.occurredOn;
  }
}
