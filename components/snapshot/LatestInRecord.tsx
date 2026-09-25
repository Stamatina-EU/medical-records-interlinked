/**
 * "Latest in your record" — compact, grouped, scalable. One row per category (measurements,
 * treatment, imaging): a deterministic count, the latest documented item (opens its evidence),
 * and a way deeper into History. Never one card per value.
 */
import Link from "next/link";
import type { ImagingExam, LabMeasurement, MedicationStatusEvent } from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import type { LatestGroup } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { ChevronIcon } from "@/components/shell/icons";
import { CalculatedLabel, FactValue, SourceRef } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

const TITLES: Record<LatestGroup["kind"], string> = {
  measurements: "Measurements",
  treatment: "Treatment / medication",
  imaging: "Imaging",
};

const VIEW_LABEL: Record<LatestGroup["kind"], string> = {
  measurements: "View measurements",
  treatment: "View treatment history",
  imaging: "View imaging",
};

function Latest({ group, index }: { group: LatestGroup; index: EvidenceIndex }) {
  switch (group.kind) {
    case "measurements": {
      const m = index.facts[group.latestFactId] as LabMeasurement;
      return (
        <>
          <FactValue factId={m.id} className={styles.groupLatest}>
            Latest: <strong>Ferritin {m.value} {m.unit}</strong> · {formatDate(m.measuredOn)}
          </FactValue>
          {group.claimKeys.map((k) => (
            <CalculatedLabel key={k} claimKey={k} />
          ))}
        </>
      );
    }
    case "treatment": {
      const e = index.facts[group.latestEventId] as MedicationStatusEvent;
      const name = (index.episodes[e.episodeId] ?? "Medication").split(" (")[0];
      return (
        <FactValue factId={e.id} className={styles.groupLatest}>
          <strong>
            {name} · {e.status}
          </strong>{" "}
          · documented {formatDate(e.documentedOn)}
        </FactValue>
      );
    }
    case "imaging": {
      const x = index.facts[group.latestExamId] as ImagingExam;
      return (
        <FactValue factId={x.id} className={styles.groupLatest}>
          Latest: <strong>{formatDate(x.performedOn)}</strong> · {x.examName}
        </FactValue>
      );
    }
  }
}

export default function LatestInRecord({ groups, index }: { groups: LatestGroup[]; index: EvidenceIndex }) {
  if (groups.length === 0) return null;
  return (
    <section className={styles.module} aria-labelledby="latest-heading">
      <div className={styles.moduleHead}>
        <h2 id="latest-heading" className={styles.moduleTitle}>
          Latest in your record
        </h2>
        <p className={styles.moduleNote}>The most recent documented item in each part of your record</p>
      </div>
      <ul className={`${styles.surface} ${styles.groups}`}>
        {groups.map((g) => (
          <li key={g.kind} className={styles.group}>
            <div className={styles.groupHead}>
              <h3 className={styles.groupTitle}>{TITLES[g.kind]}</h3>
              <p className={styles.groupCount}>{g.countLabel}</p>
            </div>
            <div className={styles.groupBody}>
              <div className={styles.groupLatestLine}>
                <Latest group={g} index={index} />
              </div>
              <SourceRef factId={g.kind === "measurements" ? g.latestFactId : g.kind === "treatment" ? g.latestEventId : g.latestExamId} />
            </div>
            <Link href={g.href} className={styles.groupLink} aria-label={VIEW_LABEL[g.kind]}>
              <span className={styles.groupLinkText}>View</span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
