import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import StateError from "@/components/ui/StateError";
import SourceCollection from "@/components/sources/SourceCollection";
export const dynamic = "force-dynamic";
export default async function SourcesPage() {
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
      <main className="page">
        <SourceCollection documents={state.documents} facts={state.facts} />
      </main>
    </EvidenceProvider>
  );
}
