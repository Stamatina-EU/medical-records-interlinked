import Link from "next/link";
import type {
  TrustedState,
  LabMeasurement,
  ImagingExam,
  MedicationStatusEvent,
  FollowUp,
} from "@/lib/model/types";
import type { SnapshotView } from "@/lib/view/snapshot";
import type { EvidenceIndex } from "@/lib/evidence/index";
import { formatDate, formatSpan } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";
import {
  FactValue,
  SourceRef,
  CalculatedLabel,
} from "@/components/ui/EvidenceLinks";
import AddRecord from "@/components/add-record/AddRecord";
import WhatChanged from "./WhatChanged";
import styles from "./recordbook.module.css";
import VisualIcon from "@/components/ui/VisualIcon";

export default function RecordBook({
  state,
  view,
  index,
}: {
  state: TrustedState;
  view: SnapshotView;
  index: EvidenceIndex;
}) {
  const measurement = view.latestGroups.find((g) => g.kind === "measurements");
  const treatment = view.latestGroups.find((g) => g.kind === "treatment");
  const imaging = view.latestGroups.find((g) => g.kind === "imaging");
  const m =
    measurement?.kind === "measurements"
      ? (index.facts[measurement.latestFactId] as LabMeasurement)
      : null;
  const t =
    treatment?.kind === "treatment"
      ? (index.facts[treatment.latestEventId] as MedicationStatusEvent)
      : null;
  const x =
    imaging?.kind === "imaging"
      ? (index.facts[imaging.latestExamId] as ImagingExam)
      : null;
  const latest =
    view.latestUpdate?.document ??
    [...state.documents].sort((a, b) => b.date.localeCompare(a.date))[0];
  const addedCount = view.latestUpdate
    ? state.latestUpdate!.approvedFactIds.length
    : state.facts.filter((f) => f.source.documentId === latest?.id).length;
  return (
    <>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            <VisualIcon name="notebook-tabs" size={17} />
            Your medical record
          </p>
          <h1>{view.patientName}</h1>
          <p className={styles.demo}>
            Fictional patient · synthetic demo record
          </p>
        </div>
        <VisualIcon name="files" size={128} className={styles.documentMotif} />
        <AddRecord />
      </header>
      {latest && (
        <div className={styles.latest}>
          <VisualIcon name="files" size={26} className={styles.latestIcon} />
          <span className={styles.latestLabel}>
            {view.latestUpdate ? "Latest addition" : "Latest source in record"}
          </span>
          <div>
            <strong>{latest.title}</strong>
            <span> · {formatDate(latest.date)}</span>
            <p>
              {addedCount}{" "}
              {view.latestUpdate
                ? `${addedCount === 1 ? "fact" : "facts"} added with your approval`
                : `documented ${addedCount === 1 ? "fact" : "facts"}`}
            </p>
          </div>
          <a
            href={
              view.latestUpdate ? "#record-changes" : "/sources#" + latest.id
            }
          >
            {view.latestUpdate ? "See changes" : "View source"} →
          </a>
        </div>
      )}
      {view.latestUpdate && (
        <details id="record-changes" className={styles.changes}>
          <summary>Changes from the latest addition</summary>
          <WhatChanged
            document={view.latestUpdate.document}
            changes={view.latestUpdate.changes}
          />
        </details>
      )}
      <div className={styles.pictureHeading}>
        <h2>The documented picture</h2>
        <p>Read a fact. Follow its source.</p>
      </div>
      <div className={styles.chapters}>
        {(m || t) && (
          <section
            className={`${styles.chapter} ${styles.ironChapter}`}
            aria-labelledby="iron-chapter"
          >
            <div className={styles.chapterHead}>
              <span className={styles.chapterNumber}>01</span>
              <VisualIcon
                name="flask-conical"
                size={28}
                className={styles.chapterIcon}
              />
              <h2 id="iron-chapter">Iron / Ferritin</h2>
            </div>
            {m && (
              <div className={styles.measurement}>
                <p className={styles.label}>
                  Ferritin · {formatDate(m.measuredOn)}
                </p>
                <FactValue factId={m.id} className={styles.value}>
                  {m.value} <span>{m.unit}</span>
                </FactValue>
                {m.refText && (
                  <p className={styles.meta}>
                    Supplied range {m.refText} {m.unit}
                  </p>
                )}
                <SourceRef factId={m.id} />
                <div className={styles.selection}>
                  <CalculatedLabel
                    claimKey={measurement!.countClaimKey}
                    label="Why this is the latest result"
                  />
                </div>
              </div>
            )}
            {t && (
              <div className={styles.medication}>
                <p className={styles.label}>
                  <VisualIcon name="pill" size={17} />
                  Documented medication status
                </p>
                <FactValue factId={t.id}>
                  <strong>{index.episodes[t.episodeId]}</strong>
                  <br />
                  {statusLabel(t.status)} · documented{" "}
                  {formatDate(t.documentedOn)}
                </FactValue>
                <SourceRef factId={t.id} />
                <CalculatedLabel
                  claimKey={treatment!.countClaimKey}
                  label="How the latest status was selected"
                />
              </div>
            )}
            <Link className={styles.chapterLink} href="/history/iron">
              Read the iron history <span>→</span>
            </Link>
          </section>
        )}
        {x && (
          <section
            className={`${styles.chapter} ${styles.imagingChapter}`}
            aria-labelledby="imaging-chapter"
          >
            <div className={styles.chapterHead}>
              <span className={styles.chapterNumber}>02</span>
              <VisualIcon
                name="scan-line"
                size={28}
                className={styles.chapterIcon}
              />
              <h2 id="imaging-chapter">Imaging</h2>
            </div>
            <p className={styles.label}>{formatDate(x.performedOn)}</p>
            <FactValue factId={x.id} className={styles.exam}>
              {x.examName}
            </FactValue>
            <p className={styles.statement}>{x.statement}</p>
            <SourceRef factId={x.id} />
            <div className={styles.selection}>
              <CalculatedLabel
                claimKey={imaging!.countClaimKey}
                label="Why this is the latest examination"
              />
            </div>
            <Link className={styles.chapterLink} href="/history/imaging">
              Read the imaging history <span>→</span>
            </Link>
          </section>
        )}
      </div>
      {view.followUpsOnRecord.length > 0 && (
        <section
          className={styles.recommendations}
          aria-labelledby="recommendations"
        >
          <div className={styles.sectionHead}>
            <VisualIcon name="clipboard-list" size={30} />
            <div>
              <h2 id="recommendations">Recommendations in the record</h2>
              <p>As documented in your sources</p>
            </div>
          </div>
          {view.followUpsOnRecord.map((item) => {
            const f = index.facts[item.factId] as FollowUp;
            return (
              <div key={f.id} className={styles.recommendation}>
                <div>
                  <p className={styles.label}>
                    {f.topic === "iron" ? "Iron / Ferritin" : "Imaging"} ·{" "}
                    {formatDate(f.recommendedOn)}
                  </p>
                  <FactValue
                    factId={f.id}
                    className={styles.recommendationText}
                  >
                    {f.recommendation}
                  </FactValue>
                  <SourceRef factId={f.id} />
                </div>
                {item.stateKey && (
                  <div className={styles.consequence}>
                    <p className={styles.label}>
                      <VisualIcon name="network" size={17} />
                      Calculated from your records
                    </p>
                    <CalculatedLabel claimKey={item.stateKey} />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
      <Link href="/summary" className={styles.summary}>
        <VisualIcon
          name="notebook-tabs"
          size={48}
          className={styles.summaryIcon}
        />
        <div>
          <p className={styles.eyebrow}>For your next conversation</p>
          <h2>Doctor Summary</h2>
          <p>A concise brief, with the evidence still attached.</p>
        </div>
        <span>Read summary →</span>
      </Link>
      <footer className={styles.coverage}>
        <span>
          {view.summary.documentCount} source document
          {view.summary.documentCount === 1 ? "" : "s"}
          {view.summary.firstDocumentDate && view.summary.lastDocumentDate
            ? " · " +
              formatSpan(
                view.summary.firstDocumentDate,
                view.summary.lastDocumentDate,
              )
            : ""}
        </span>
        <Link href="/sources">Explore Sources →</Link>
      </footer>
    </>
  );
}
