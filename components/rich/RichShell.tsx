import Link from "next/link";
import type { RecordState } from "@/lib/demo/model";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import { richEvidence } from "@/lib/rich/evidence";
import visual from "@/components/ui/recordbookVisual.module.css";
import styles from "./rich.module.css";

export function RichDemoNotice({integrated=false,compact=false}:{integrated?:boolean;compact?:boolean}) {
  return <aside className={`${styles.demoBanner}${compact ? ` ${styles.demoBannerCompact}` : ""}`} aria-label="Rich demo scope">
    <div><strong>{integrated ? "Synthetic demo record" : "Rich synthetic demo · Read only"}</strong><span>{integrated ? <>{"Curated synthetic baseline · "}<span className={styles.liveScope}>Live Add record: ferritin + oral iron only.</span></> : "Curated synthetic baseline with source wording checked against its PDFs. Separate from live Add record."}</span></div>
    <Link href={integrated ? "/sources" : "/"}>{integrated ? "Explore source documents" : "Open the hackathon demo ↗"}</Link>
  </aside>;
}

export default function RichShell({state,children,integrated=false,showDemoNotice=true}:{state:RecordState;children:React.ReactNode;integrated?:boolean;showDemoNotice?:boolean}) {
  return <EvidenceProvider index={richEvidence(state,integrated)}>
    <main className={`page ${visual.theme} ${visual.pageCanvas} ${visual.proposalTheme} ${visual.destinationPage} ${styles.page}`}>
      {showDemoNotice && <RichDemoNotice integrated={integrated}/>}
      {children}
    </main>
  </EvidenceProvider>;
}
