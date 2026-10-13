import AddRecord from "@/components/add-record/AddRecord";
import WhatChanged from "@/components/snapshot/WhatChanged";
import { recordChangesSummary,recordCalculations } from "@/lib/demo/record";
import Link from "next/link";
import type { DocumentedIncident } from "@/lib/model/rich";
import type { RecordState } from "@/lib/demo/model";
import { laboratoryGroups } from "@/lib/rich/derive";
import { formatDate } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";
import { FactValue,SourceRef,CalculatedLabel } from "@/components/ui/EvidenceLinks";
import VisualIcon from "@/components/ui/VisualIcon";
import styles from "./rich.module.css";
export function IncidentSection({incident}:{incident:DocumentedIncident}) {
  return <section className={styles.chapter} id="incidents">
    <div className={styles.chapterHead}><h2><VisualIcon name="clipboard-list" />Documented incident</h2><span className={styles.direct}>Direct · source wording</span></div>
    <p className={styles.meta}>{incident.occurredOn ? `Incident date ${formatDate(incident.occurredOn)}` : "Incident date not supplied"} · Document date {formatDate(incident.documentedOn)}</p>
    <FactValue factId={incident.id} className={styles.statement}>{incident.statement}</FactValue>
    <div className={styles.sourceLine}><SourceRef factId={incident.id}/><span>Exact wording retained from the emergency department note.</span></div>
  </section>;
}
export default function RichRecord({state,integrated=false}:{state:RecordState;integrated?:boolean}) {
  const base=integrated ? "" : "/rich";
  const groups=laboratoryGroups(state);
  const calculations=recordCalculations(state);
  const update=state.latestUpdate ? state.documents.find(d=>d.id===state.latestUpdate!.documentId) : undefined;
  const imaging=state.facts.filter(f=>f.kind==="imaging_exam").sort((a,b)=>b.performedOn.localeCompare(a.performedOn));
  const medications=state.facts.filter(f=>f.kind==="medication_status");
  const incident=state.facts.find((f):f is DocumentedIncident=>f.kind==="documented_incident");
  const followups=state.facts.filter(f=>f.kind==="follow_up");
  return <>
    <header className={styles.recordHead}>
      <p className={styles.kicker}><VisualIcon name="notebook-tabs" size={19}/>{integrated ? "Your medical record" : "Your medical record · density study"}</p>
      <h1>{state.patient.displayName}</h1>
      <p>Fictional patient · longitudinal synthetic record</p>
      {integrated && <AddRecord/>}
    </header>
    {update && <div className={styles.approvedUpdate}><WhatChanged document={update} changes={recordChangesSummary(state)} compact/></div>}
    <section className={styles.chapter}>
      <div className={styles.chapterHead}><h2><VisualIcon name="flask-conical"/>Laboratory measurements</h2><Link className={styles.action} href={base+"/laboratory"}>View all dated measurements →</Link></div>
      <div className={styles.overviewNote}><CalculatedLabel claimKey="rich:laboratory-overview" label={`${groups.reduce((n,g)=>n+g.measurements.length,0)} measurements · ${groups.length} analytes`}/><p>Latest documented dates. Fixed analyte order; no clinical ranking.</p></div>
      <div className={styles.tableHead} aria-hidden="true"><span>Analyte</span><span>Latest documented value · Direct</span><span>Measured date</span><span>Source</span></div>
      <ul className={styles.overview}>
        {groups.map(g=><li key={g.id}>
          <div className={styles.analyte}>{g.label}</div>
          <div className={styles.latestValues}>{g.latest.map(f=><FactValue key={f.id} factId={f.id} className={styles.measurement}><strong>{f.value}</strong> <span>{f.unit}</span></FactValue>)}</div>
          <time dateTime={g.latest[0].measuredOn}>{formatDate(g.latest[0].measuredOn)}</time>
          <div className={styles.sources}>{g.latest.map(f=><SourceRef key={f.id} factId={f.id}/>)}</div>
        </li>)}
      </ul>
      <p className={styles.chapterFoot}>Every result retains its own supplied range, date and exact source. Grouping and “latest” are calculated; values are source facts.</p>
    </section>
    <div className={styles.chapterGrid}>
      <section className={styles.chapter} id="imaging">
        <div className={styles.chapterHead}><h2><VisualIcon name="scan-line"/>Imaging</h2></div>
        <CalculatedLabel claimKey="record-imaging" label="Documented imaging history"/>
        {imaging.slice(0,1).map(f=><div key={f.id}><p className={styles.meta}>{formatDate(f.performedOn)} · Direct</p><h3>{f.examName}</h3><FactValue factId={f.id} className={styles.statement}>{f.statement}</FactValue><SourceRef factId={f.id}/></div>)}
        <Link className={styles.textLink} href={base+"/history#imaging"}>Read the imaging history →</Link>
      </section>
      <section className={styles.chapter} id="medication">
        <div className={styles.chapterHead}><h2><VisualIcon name="pill"/>Medication statements</h2></div>
        {medications.map(f=><div key={f.id}><p className={styles.meta}>{formatDate(f.documentedOn)} · Direct</p><h3>{state.episodes.find(e=>e.id===f.episodeId)?.name}</h3><FactValue factId={f.id} className={styles.statement}>{statusLabel(f.status)}</FactValue><SourceRef factId={f.id}/></div>)}
        <Link className={styles.textLink} href={base+"/history#medication"}>Read the dated record →</Link>
      </section>
    </div>
    {incident && <IncidentSection incident={incident}/>}
    <section className={styles.chapter}>
      <div className={styles.chapterHead}><h2><VisualIcon name="clipboard-list"/>Documented recommendations</h2><span className={styles.direct}>Direct · source wording</span></div>
      <ul className={styles.recommendations}>{followups.map(f=><li key={f.id}><time dateTime={f.recommendedOn}>{formatDate(f.recommendedOn)}</time><FactValue factId={f.id} className={styles.statement}>{f.recommendation}</FactValue><SourceRef factId={f.id}/>{calculations.some(c=>c.key===`followup-match:${f.id}`) && <CalculatedLabel claimKey={`followup-match:${f.id}`}/>}</li>)}</ul>
    </section>
    <footer className={styles.scopeFooter}><div><h2>Doctor Summary</h2><p>{integrated ? "A deterministic, evidence-linked summary of this record’s measurements, medication, imaging, recommendations and documented incident." : "This retained read-only study does not include live additions. The current default Doctor Summary covers the composed rich record."}</p></div><Link className={styles.action} href={base+"/summary"}>{integrated ? "Read Doctor Summary →" : "View summary scope →"}</Link></footer>
  </>;
}
