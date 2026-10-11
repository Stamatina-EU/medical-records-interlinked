import Link from "next/link";
import type { RecordState } from "@/lib/demo/model";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import { richEvidence } from "@/lib/rich/evidence";
import visual from "@/components/ui/recordbookVisual.module.css";
import styles from "./rich.module.css";
export default function RichShell({state,children,integrated=false}:{state:RecordState;children:React.ReactNode;integrated?:boolean}) {
  return <EvidenceProvider index={richEvidence(state,integrated)}>
    <main className={`page ${visual.theme} ${visual.pageCanvas} ${visual.proposalTheme} ${visual.destinationPage} ${styles.page}`}>
      <aside className={styles.demoBanner} aria-label="Rich demo scope">
        <div><strong>{integrated ? "Synthetic demo record" : "Rich synthetic demo · Read only"}</strong><span>{integrated ? "Verified synthetic baseline + patient-approved additions. Live Add record: ferritin and oral iron only." : "Prepared fixtures with verified PDF sources. Separate from live Add record."}</span></div>
        <Link href={integrated ? "/sources" : "/"}>{integrated ? "Explore source documents ↗" : "Open the hackathon demo ↗"}</Link>
      </aside>
      {children}
    </main>
  </EvidenceProvider>;
}
