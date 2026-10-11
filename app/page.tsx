import { demoProfile } from "@/lib/demo/profile";
import { readRichRecord } from "@/lib/demo/store";
import RichShell from "@/components/rich/RichShell";
import RichRecord from "@/components/rich/RichRecord";
/**
 * Recordbook presentation of the existing snapshot and evidence models.
 * The deterministic engines and trusted state remain unchanged.
 */
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { recordClaims } from "@/lib/engine/recordClaims";
import { snapshotView } from "@/lib/view/snapshot";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import SnapshotHeader from "@/components/snapshot/SnapshotHeader";
import RecordBook from "@/components/snapshot/RecordBook";
import visual from "@/components/ui/recordbookVisual.module.css";
import StartRecord from "@/components/snapshot/StartRecord";
import StateError from "@/components/ui/StateError";
import { isEmptyRecord } from "@/lib/view/emptyRecord";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if(demoProfile()==="rich"){const {record}=await readRichRecord();return <RichShell state={record} integrated><RichRecord state={record} integrated/></RichShell>;}
  let state;
  try {
    state = await readState();
  } catch (err) {
    if (err instanceof StateCorruptedError) return <StateError />;
    throw err;
  }
  const claims = derive(state);
  // record claims (counts, "latest" selection) open in the drawer like any other derived claim
  const index = buildEvidenceIndex(state, [...claims, ...recordClaims(state)]);
  const view = snapshotView(state, claims);

  // a genuinely empty record: Home itself is the first-use start (never the case for the seeded demo)
  if (isEmptyRecord(state)) {
    return (
      <EvidenceProvider index={index}>
        <main className="page utilityPage">
          <SnapshotHeader
            name={view.patientName}
            lastUpdated={view.lastUpdated}
            updatedFrom={null}
            empty
          />
          <StartRecord />
        </main>
      </EvidenceProvider>
    );
  }

  return (
    <EvidenceProvider index={index} visualDirection="proposal-1">
      <main className={`page ${visual.theme} ${visual.pageCanvas} ${visual.proposalTheme} ${visual.lockedRecord}`}>
        <RecordBook state={state} view={view} index={index} />
      </main>
    </EvidenceProvider>
  );
}
