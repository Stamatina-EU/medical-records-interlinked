import { demoProfile } from "@/lib/demo/profile";
import { readRichRecord } from "@/lib/demo/store";
import RichShell from "@/components/rich/RichShell";
import RichDoctorSummary from "@/components/rich/RichDoctorSummary";
import visual from "@/components/ui/recordbookVisual.module.css";
/**
 * Doctor Summary — a concise, user-controlled, evidence-linked view of the history represented
 * in MRI (Medical Records Interlinked), to show or discuss with a new doctor. The one deliberately typeset clinical brief.
 * It is not a claim to be the doctor's only access to the patient's history.
 * Spec: `spec.md > Doctor Summary Page`; PRD: `prd.md > Doctor Summary`.
 */
import Link from "next/link";
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { composeDoctorSummary, refKey, type Statement } from "@/lib/summary/compose";
import { formatDate } from "@/lib/text/dates";
import { plural } from "@/lib/text/plural";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import SourceChip from "@/components/summary/SourceChip";
import StateError from "@/components/ui/StateError";
import { isEmptyRecord } from "@/lib/view/emptyRecord";
import styles from "@/components/summary/summary.module.css";

export const dynamic = "force-dynamic";

export default async function DoctorSummaryPage() {
  if(demoProfile()==="rich"){const {record}=await readRichRecord();return <RichShell state={record} integrated><RichDoctorSummary state={record}/></RichShell>;}
  let state;
  try {
    state = await readState();
  } catch (err) {
    if (err instanceof StateCorruptedError) return <StateError />;
    throw err;
  }

  // a genuinely empty record has nothing to summarize yet (never the case for the seeded demo)
  if (isEmptyRecord(state)) {
    return (
      <main className={`page ${visual.proposalTheme} ${visual.pageCanvas} ${visual.destinationPage} ${visual.documentPage}`}>
        <article className={styles.sheet} aria-labelledby="summary-title">
          <header className={styles.head}>
            <p className={styles.kicker}>Doctor Summary</p>
            <h1 id="summary-title" className={styles.patient}>
              {state.patient.displayName} <span className={styles.synthetic}>fictional · synthetic demo record</span>
            </h1>
          </header>
          <p className={styles.emptyNote}>
            Nothing to summarize yet. <Link href="/">Add your first record on Home.</Link>
          </p>
        </article>
      </main>
    );
  }

  const claims = derive(state);
  const summary = composeDoctorSummary(state, claims);
  // the summary's own derived claims (counts, "latest") open in the drawer like any other
  const index = buildEvidenceIndex(state, [...claims, ...summary.claims]);

  return (
    <EvidenceProvider index={index}>
      <main className={`page ${visual.proposalTheme} ${visual.pageCanvas} ${visual.destinationPage} ${visual.documentPage}`}>
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
      </main>
    </EvidenceProvider>
  );
}
