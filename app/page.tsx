/**
 * Snapshot Page — "What is documented now, and what changed?"
 * Spec: `spec.md > Snapshot Page`; PRD: `prd.md > Snapshot`.
 */
import Link from "next/link";
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { snapshotView } from "@/lib/view/snapshot";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import SnapshotHeader from "@/components/snapshot/SnapshotHeader";
import IronSection from "@/components/snapshot/IronSection";
import ImagingSection from "@/components/snapshot/ImagingSection";
import StateError from "@/components/ui/StateError";
import styles from "@/components/snapshot/snapshot.module.css";

export const dynamic = "force-dynamic";

export default async function SnapshotPage() {
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
        <SnapshotHeader name={view.patientName} lastUpdated={view.lastUpdated} />
        <IronSection view={view.iron} index={index} />
        <ImagingSection view={view.imaging} index={index} />
        <p className={styles.summaryLink}>
          <Link href="/summary">View Doctor Summary →</Link>
        </p>
      </main>
    </EvidenceProvider>
  );
}
