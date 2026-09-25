/**
 * Home (the Snapshot) — Alex Rowan's personal space inside MyHeDo. Summary-first and scalable.
 * Spec: `spec.md > Snapshot Page`; PRD: `prd.md > Snapshot`.
 * Order: Identity → Your record at a glance → (What changed, only after an approved update) →
 *        Latest in your record → Follow-up on record | Your history.
 */
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { snapshotView } from "@/lib/view/snapshot";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import SnapshotHeader from "@/components/snapshot/SnapshotHeader";
import HealthSummary from "@/components/snapshot/HealthSummary";
import LatestInRecord from "@/components/snapshot/LatestInRecord";
import WhatChanged from "@/components/snapshot/WhatChanged";
import FollowUpOnRecord from "@/components/snapshot/FollowUpOnRecord";
import HistoryTopics from "@/components/snapshot/HistoryTopics";
import StateError from "@/components/ui/StateError";
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
        <SnapshotHeader name={view.patientName} lastUpdated={view.lastUpdated} updatedFrom={view.latestUpdate?.document ?? null} />
        <HealthSummary summary={view.summary} />
        {/* "What changed" appears only after a new record is approved — its first appearance is the reveal. */}
        {view.latestUpdate && <WhatChanged document={view.latestUpdate.document} changes={view.latestUpdate.changes} />}
        <LatestInRecord groups={view.latestGroups} index={index} />
        <div className={styles.lowerGrid}>
          <FollowUpOnRecord items={view.followUpsOnRecord} index={index} />
          <HistoryTopics topics={view.history} />
        </div>
      </main>
    </EvidenceProvider>
  );
}
