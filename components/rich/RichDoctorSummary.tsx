import Link from "next/link";
import type { RecordState } from "@/lib/demo/model";
import { composeRichSummary } from "@/lib/demo/summary";
import { refKey,type Statement } from "@/lib/summary/compose";
import { formatDate } from "@/lib/text/dates";
import { plural } from "@/lib/text/plural";
import SourceChip from "@/components/summary/SourceChip";
import styles from "@/components/summary/summary.module.css";
export default function RichDoctorSummary({state}:{state:RecordState}) {
 const summary=composeRichSummary(state);
 return (
        <article className={styles.sheet} aria-labelledby="summary-title">
          <header className={styles.head}>
            <p className={styles.kicker}>Doctor Summary</p>
            <h1 id="summary-title" className={styles.patient}>
              {summary.patientName} <span className={styles.synthetic}>fictional · synthetic demo record</span>
            </h1>
            <p className={styles.meta}>
              Prepared in Medical Records Interlinked (MRI) from {plural(summary.documentCount, "source document")}
              {summary.latestSourceDate && ` · latest source dated ${formatDate(summary.latestSourceDate)}`}
            </p>
            <p className={styles.scope}>
              A concise, evidence-linked view of the documented history held in this record. Every statement links to its source;
              statements marked “derived” were calculated from the documents, not written in them.
            </p>
          </header>

          {summary.sections.map((s) => {
            // the sentence's last word and its chips never wrap apart, so a lone source number
            // can't start the next line or appear to belong to the next sentence
            const sentence = (st: Statement) => {
              const cut = st.text.lastIndexOf(" ") + 1;
              return (
                <span className={st.derived ? styles.derivedText : undefined}>
                  {st.text.slice(0, cut)}
                  <span className={styles.keep}>
                    {st.text.slice(cut)}{" "}
                    {st.refs.map((r, i) => (
                      <SourceChip key={refKey(r)} refItem={r} numbers={summary.sourceNumbers[refKey(r)] ?? []} derived={st.derived && i === 0} />
                    ))}
                  </span>
                </span>
              );
            };
            // "Current documented picture" reads as one short orientation paragraph
            if (s.id === "picture") {
              const updated = s.statements.some((st) => st.updated);
              return (
                <section key={s.id} className={styles.section} aria-labelledby={`s-${s.id}`}>
                  <h2 id={`s-${s.id}`} className={styles.sectionTitle}>
                    {s.title}
                  </h2>
                  <p className={updated ? `${styles.picture} ${styles.updated}` : styles.picture}>
                    {s.statements.map((st) => (
                      <span key={st.text}>{sentence(st)} </span>
                    ))}
                    {updated && <span className={styles.updatedLabel}>Updated from latest record</span>}
                  </p>
                </section>
              );
            }
            return (
              <section key={s.id} className={styles.section} aria-labelledby={`s-${s.id}`}>
                <h2 id={`s-${s.id}`} className={styles.sectionTitle}>
                  {s.title}
                </h2>
                <ul className={styles.statements}>
                  {s.statements.map((st) => (
                    <li key={st.text} className={st.updated ? `${styles.statement} ${styles.updated}` : styles.statement}>
                      {sentence(st)}
                      {st.updated && <span className={styles.updatedLabel}>Updated from latest record</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

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
 );
}
