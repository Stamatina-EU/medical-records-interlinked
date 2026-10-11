import { readRichState } from "@/lib/rich/read";
import RichShell from "@/components/rich/RichShell";
import RichRecord from "@/components/rich/RichRecord";
export const dynamic="force-dynamic";
export default async function RichRecordPage() {
  const state=await readRichState();
  return <RichShell state={state}><RichRecord state={state}/></RichShell>;
}
