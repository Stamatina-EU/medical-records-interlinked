import { demoProfile } from "@/lib/demo/profile";
import { readRichRecord } from "@/lib/demo/store";
import RichShell from "@/components/rich/RichShell";
import visual from "@/components/ui/recordbookVisual.module.css";
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import StateError from "@/components/ui/StateError";
import SourceCollection from "@/components/sources/SourceCollection";
export const dynamic = "force-dynamic";
export default async function SourcesPage() {
  if(demoProfile()==="rich"){const {record}=await readRichRecord();return <RichShell state={record} integrated><SourceCollection documents={record.documents} facts={record.facts}/></RichShell>;}
  let state;
  try {
    state = await readState();
  } catch (err) {
    if (err instanceof StateCorruptedError) return <StateError />;
    throw err;
  }
  const index = buildEvidenceIndex(state, derive(state));
  return (
    <EvidenceProvider index={index}>
      <main className={`page ${visual.proposalTheme} ${visual.pageCanvas} ${visual.destinationPage}`}>
        <SourceCollection documents={state.documents} facts={state.facts} />
      </main>
    </EvidenceProvider>
  );
}
