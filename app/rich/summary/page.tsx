import Link from "next/link";
import { readRichState } from "@/lib/rich/read";
import RichShell from "@/components/rich/RichShell";
import styles from "@/components/rich/rich.module.css";
export const dynamic="force-dynamic";
export default async function RichSummaryScopePage() {
 const state=await readRichState();
 return <RichShell state={state}><section className={`${styles.chapter} ${styles.summaryNotice}`}><h1>Doctor Summary · design study</h1><p>This /rich route is a retained read-only design study of the verified rich synthetic baseline. It does not include patient-approved live additions.</p><p>The current default /summary is the completed composed-record Doctor Summary. It covers the verified rich baseline plus patient-approved live additions using deterministic, evidence-linked templates.</p><Link className={styles.action} href="/rich">Return to the read-only rich Record →</Link><p><Link className={styles.textLink} href="/summary">Open the completed Doctor Summary ↗</Link></p></section></RichShell>;
}
