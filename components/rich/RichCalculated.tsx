"use client";
import { useEvidence } from "@/components/evidence/EvidenceProvider";
import VisualIcon from "@/components/ui/VisualIcon";
import styles from "./rich.module.css";
/** Compact derived disclosure for dense rich lists; no change to default affordances. */
export default function RichCalculated({claimKey,text}:{claimKey:string;text?:string}) {
 const {index,open}=useEvidence(),claim=index.claims[claimKey];
 if(!claim) return null;
 const displayText=text ?? (claim.kind==="range_status" ? claim.text.replace("this result's supplied laboratory range","its supplied range") : claim.text);
 return <button type="button" className={styles.calculation} onClick={()=>open({type:"claim",key:claimKey})}
  aria-label={`${displayText} (calculated from your records — show how this was determined)`}
  title="Calculated from your records — show rule and input facts"><VisualIcon name="network" size={15}/><span>Calculated · {displayText}</span></button>;
}
