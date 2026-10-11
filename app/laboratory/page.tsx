import { redirect } from "next/navigation";
import Link from "next/link";
import { demoProfile } from "@/lib/demo/profile";
import { readRichRecord } from "@/lib/demo/store";
import RichShell from "@/components/rich/RichShell";
import LaboratoryRecord from "@/components/rich/LaboratoryRecord";
import styles from "@/components/rich/rich.module.css";
export const dynamic="force-dynamic";
export default async function LaboratoryPage(){if(demoProfile()==="legacy")redirect("/history/iron");const {record}=await readRichRecord();return <RichShell state={record} integrated><header className={styles.recordHead}><p className={styles.kicker}>All dated measurements</p><h1>Laboratory measurements</h1><p>Each result retains its original unit and supplied laboratory range.</p><Link className={styles.action} style={{color:"#fff"}} href="/">← Back to Record</Link></header><LaboratoryRecord state={record}/></RichShell>;}
