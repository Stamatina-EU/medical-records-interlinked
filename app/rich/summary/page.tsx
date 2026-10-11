import Link from "next/link";
import { readRichState } from "@/lib/rich/read";
import RichShell from "@/components/rich/RichShell";
import styles from "@/components/rich/rich.module.css";
export const dynamic="force-dynamic";
export default async function RichSummaryScopePage() {
 const state=await readRichState();
 return <RichShell state={state}><section className={`${styles.chapter} ${styles.summaryNotice}`}><h1>Doctor Summary · scope</h1><p>A complete summary of this rich synthetic record has not been implemented.</p><p>The existing Doctor Summary belongs to the six-document hackathon demo. It does not represent this rich record, its additional laboratory measurements or its documented incident.</p><Link className={styles.action} href="/rich">Return to the rich Record →</Link><p><Link className={styles.textLink} href="/summary">Open the separate hackathon demo’s Summary ↗</Link></p></section></RichShell>;
}
