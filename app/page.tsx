/**
 * Home (the Snapshot) — Alex Rowan's personal space inside MyHeDo.
 * "Your current documented health picture, built from evidence you can inspect."
 * Spec: `spec.md > Snapshot Page`; PRD: `prd.md > Snapshot`.
 * Order: Identity → Latest in your record → What changed → Follow-up on record | Your history.
 */
import Link from "next/link";
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { snapshotView } from "@/lib/view/snapshot";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import SnapshotHeader from "@/components/snapshot/SnapshotHeader";
import LatestInRecord from "@/components/snapshot/LatestInRecord";
import FollowUpOnRecord from "@/components/snapshot/FollowUpOnRecord";
import HistoryTopics from "@/components/snapshot/HistoryTopics";
import StateError from "@/components/ui/StateError";
import { SummaryIcon } from "@/components/shell/icons";
import styles from "@/components/snapshot/snapshot.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let state;
  try {
    state = await readState();
  } catch (err) {
    if (err instanceof StateCorruptedError) return <StateError />;
    throw err;
  }
  const claims = derive(state);
  const index = buildEvidenceIndex(state, claims);
  const view = snapshotView(state, claims);

  return (
    <EvidenceProvider index={index}>
      <main className="page">
        <SnapshotHeader name={view.patientName} lastUpdated={view.lastUpdated} documentCount={view.documentCount} />
        <LatestInRecord view={view.rightNow} index={index} />
        {/* "What changed" appears here only after a new record is approved (slice 4) — its first appearance is the reveal. */}
        <div className={styles.lowerGrid}>
          <FollowUpOnRecord items={view.followUpsOnRecord} index={index} />
          <div className={styles.sideColumn}>
            <HistoryTopics topics={view.history} />
            <Link href="/summary" className={`${styles.surface} ${styles.summaryEntry}`}>
              <SummaryIcon />
              <span>
                <span className={styles.summaryTitle}>Doctor Summary</span>
                <span className={styles.summaryText}>A concise, source-linked view to show or discuss with a new doctor</span>
              </span>
            </Link>
          </div>
        </div>
      </main>
    </EvidenceProvider>
  );
}
