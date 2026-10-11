import Link from "next/link";
import { readRichState } from "@/lib/rich/read";
import RichShell from "@/components/rich/RichShell";
import LaboratoryRecord from "@/components/rich/LaboratoryRecord";
import styles from "@/components/rich/rich.module.css";
export const dynamic="force-dynamic";
export default async function LaboratoryPage() {
 const state=await readRichState();
 return <RichShell state={state}><header className={styles.recordHead}><p className={styles.kicker}>All dated measurements</p><h1>Laboratory measurements</h1><p>One analyte at a time, with each result’s original unit and supplied laboratory range.</p><Link className={styles.action} style={{color:"#fff"}} href="/rich">← Back to Record</Link></header><LaboratoryRecord state={state}/></RichShell>;
}
