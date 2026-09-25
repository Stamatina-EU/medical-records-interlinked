/**
 * Doctor Summary — a concise, user-controlled, evidence-linked view of the history represented
 * in MyHeDo, to show or discuss with a new doctor. The one deliberately typeset clinical brief.
 * It is not a claim to be the doctor's only access to the patient's history.
 * Spec: `spec.md > Doctor Summary Page`; PRD: `prd.md > Doctor Summary`.
 */
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { composeDoctorSummary, refKey } from "@/lib/summary/compose";
import { formatDate, formatDateTime } from "@/lib/text/dates";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import SourceChip from "@/components/summary/SourceChip";
import StateError from "@/components/ui/StateError";
import styles from "@/components/summary/summary.module.css";

export const dynamic = "force-dynamic";

export default async function DoctorSummaryPage() {
  let state;
  try {
    state = await readState();
  } catch (err) {
    if (err instanceof StateCorruptedError) return <StateError />;
    throw err;
  }
  const claims = derive(state);
  const index = buildEvidenceIndex(state, claims);
  const summary = composeDoctorSummary(state, claims);

  return (
    <EvidenceProvider index={index}>
      <main className="page">
        <article className={styles.sheet} aria-labelledby="summary-title">
          <header className={styles.head}>
            <p className={styles.kicker}>Doctor Summary</p>
            <h1 id="summary-title" className={styles.patient}>
              {summary.patientName} <span className={styles.synthetic}>fictional · synthetic demo record</span>
            </h1>
            <p className={styles.meta}>
              Prepared in MyHeDo from {summary.documentCount} source documents · as of {formatDateTime(summary.asOf)}
            </p>
            <p className={styles.scope}>
              A concise, evidence-linked view of the documented history held in MyHeDo. Every statement links to its source;
              statements marked “derived” were calculated from the documents, not written in them.
            </p>
          </header>

          {summary.sections.map((s) => (
            <section key={s.id} className={styles.section} aria-labelledby={`s-${s.id}`}>
              <h2 id={`s-${s.id}`} className={styles.sectionTitle}>
                {s.title}
              </h2>
              <ul className={styles.statements}>
                {s.statements.map((st) => (
                  <li key={st.text} className={st.updated ? `${styles.statement} ${styles.updated}` : styles.statement}>
                    <span className={st.derived ? styles.derivedText : undefined}>{st.text}</span>{" "}
                    {st.refs.map((r) => (
                      <SourceChip key={refKey(r)} refItem={r} numbers={summary.sourceNumbers[refKey(r)] ?? []} derived={st.derived} />
                    ))}
                    {st.updated && <span className={styles.updatedLabel}>Updated from latest record</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <footer className={styles.sources} aria-labelledby="sources-title">
            <h2 id="sources-title" className={styles.sectionTitle}>
              Sources
            </h2>
            <ol className={styles.sourceList}>
              {summary.sources.map((src) => (
                <li key={src.document.id}>
                  <span className={styles.sourceN}>{src.n}</span>
                  <a href={`/api/documents/${src.document.id}`} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                    {src.document.title}
                  </a>
                  <span className={styles.sourceMeta}>
                    {src.document.issuer ? ` · ${src.document.issuer}` : " · added with Add record"} · {formatDate(src.document.date)}
                  </span>
                </li>
              ))}
            </ol>
          </footer>
        </article>
      </main>
    </EvidenceProvider>
  );
}
