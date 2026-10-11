import { redirect } from "next/navigation";
import { demoProfile } from "@/lib/demo/profile";
import { readRichRecord } from "@/lib/demo/store";
import RichShell from "@/components/rich/RichShell";
import RichHistory from "@/components/rich/RichHistory";
export const dynamic="force-dynamic";
export default async function HistoryPage(){if(demoProfile()==="legacy")redirect("/history/iron");const {record}=await readRichRecord();return <RichShell state={record} integrated><RichHistory state={record}/></RichShell>;}
