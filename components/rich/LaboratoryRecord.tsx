import type { RecordState } from "@/lib/demo/model";
import { laboratoryGroups } from "@/lib/rich/derive";
import { formatDate } from "@/lib/text/dates";
import { FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import RichCalculated from "./RichCalculated";
import styles from "./rich.module.css";
export default function LaboratoryRecord({state,compact=false}:{state:RecordState;compact?:boolean}) {
  return <div className={compact?styles.compactLaboratory:styles.laboratory}>
    {laboratoryGroups(state).map(g=><section className={styles.chapter} key={g.id} id={g.id}>
      <div className={styles.chapterHead}><h2>{g.label}</h2><span className={styles.direct}>Direct measurements</span></div>
      <RichCalculated claimKey={`rich:latest:${g.id}`} text={`${g.measurements.length} results · latest dated ${formatDate(g.latest[0].measuredOn)}`}/>
      <ol className={styles.datedMeasurements}>{g.measurements.map(f=><li key={f.id}>
        <div className={styles.measurementMain}><time dateTime={f.measuredOn}>{formatDate(f.measuredOn)}</time><FactValue factId={f.id} className={styles.measurement}><strong>{f.value}</strong> <span>{f.unit}</span></FactValue><span className={styles.range}>Supplied range {f.refText ?? "not supplied"} {f.refText ? f.unit:""}</span></div>
        <div className={styles.measurementEvidence}><SourceRef factId={f.id}/><RichCalculated claimKey={`rich:range:${f.id}`}/></div>
      </li>)}</ol>
    </section>)}
  </div>;
}
