import type { RecordState } from "@/lib/demo/model";
import { richFactDate } from "@/lib/rich/derive";
import { factHeadline } from "@/lib/evidence/index";
import { formatDate } from "@/lib/text/dates";
import { FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import RichCalculated from "./RichCalculated";
import LaboratoryRecord from "./LaboratoryRecord";
import styles from "./rich.module.css";
export default function RichHistory({state}:{state:RecordState}) {
  const episodes=Object.fromEntries(state.episodes.map(e=>[e.id,e.name]));
  const other=state.facts.filter(f=>f.kind!=="lab_measurement").sort((a,b)=>(richFactDate(b)??"").localeCompare(richFactDate(a)??"")||a.id.localeCompare(b.id));
  return <>
    <header className={styles.recordHead}><p className={styles.kicker}>The longitudinal record</p><h1>History</h1><p>Measurements grouped by analyte. Other source statements ordered by their documented dates.</p></header>
    <div className={styles.historyGrid}>
      <section><div className={styles.outsideHead}><h2>Laboratory measurements</h2><div className={styles.calculationBand}><RichCalculated claimKey="rich:laboratory-overview"/></div></div><LaboratoryRecord state={state} compact/></section>
      <section className={styles.chronology}><div className={styles.outsideHead}><h2>Dated source record</h2><p>Chronology is not evidence of causality between events.</p></div>
        <ol className={styles.timeline}>{other.map(f=>{
          const date=richFactDate(f),headline=factHeadline(f,episodes);
          const label=f.kind==="documented_incident"?"Documented incident":f.kind==="follow_up"?"Recommendation":f.kind==="medication_status"?"Medication statement":"Imaging";
          return <li key={f.id} className={styles.chapter} id={other.find(x=>x.kind===f.kind)?.id===f.id ? (f.kind==="imaging_exam"?"imaging":f.kind==="medication_status"?"medication":f.kind==="documented_incident"?"incidents":"recommendations") : undefined}>
            <div className={styles.eventHead}><time dateTime={date??undefined}>{date?formatDate(date):"Incident date not supplied"}</time><span className={styles.direct}>Direct</span></div>
            <p className={styles.eventType}>{label}</p><h3>{headline.label}</h3>
            <FactValue factId={f.id} className={styles.statement}>{f.kind==="imaging_exam"?f.statement:headline.value}</FactValue>
            {f.kind==="documented_incident" && <p className={styles.meta}>Document date {formatDate(f.documentedOn)}</p>}
            <SourceRef factId={f.id}/>
          </li>;
        })}</ol>
      </section>
    </div>
  </>;
}
