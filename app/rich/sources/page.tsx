import { readRichState } from "@/lib/rich/read";
import RichShell from "@/components/rich/RichShell";
import SourceCollection from "@/components/sources/SourceCollection";
export const dynamic="force-dynamic";
export default async function RichSourcesPage() {
 const state=await readRichState();
 return <RichShell state={state}><SourceCollection documents={state.documents} facts={state.facts}/></RichShell>;
}
