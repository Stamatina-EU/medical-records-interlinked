import { readRichState } from "@/lib/rich/read";
import RichShell from "@/components/rich/RichShell";
import RichHistory from "@/components/rich/RichHistory";
export const dynamic="force-dynamic";
export default async function RichHistoryPage() {
 const state=await readRichState();
 return <RichShell state={state}><RichHistory state={state}/></RichShell>;
}
