"use client";
/**
 * Drawer view for a CALCULATED claim: "How this was determined" + the structured input facts.
 * A derived (CALCULATED) claim never shows a single excerpt as though a document stated it.
 * User-facing wording is "Derived"; `CalculatedClaim` stays the internal data-model term.
 */
import type {
  CalculatedClaim,
  FollowUp,
  LabMeasurement,
} from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import { documentShortLabel, factHeadline } from "@/lib/evidence/index";
import { monthsBetween } from "@/lib/text/dates";
import styles from "./evidence.module.css";
import VisualIcon from "@/components/ui/VisualIcon";

type Props = {
  claim: CalculatedClaim;
  index: EvidenceIndex;
  onOpenFact: (id: string) => void;
};

function chronology(
  claim: CalculatedClaim,
  index: EvidenceIndex,
): string | null {
  if (claim.kind !== "followup_match") return null;
  const fu = index.facts[claim.inputFactIds[0]] as FollowUp | undefined;
  const m = index.facts[claim.inputFactIds[1]] as LabMeasurement | undefined;
  if (!fu || !m) return null;
  const months = monthsBetween(fu.recommendedOn, m.measuredOn);
  return `The result is dated ${months} month${months === 1 ? "" : "s"} after the recommendation.`;
}

export default function CalculatedClaimView({
  claim,
  index,
  onOpenFact,
}: Props) {
  const note = chronology(claim, index);
  return (
    <div className={styles.calculatedView}>
      <div className={styles.claimHeader}>
        <p className={styles.kind}>
          <VisualIcon name="network" size={20} />
          Calculated from your records
        </p>
        <h2 className={styles.factLabel}>{claim.text}</h2>
      </div>

      <h3 className={styles.sectionHeading}>How this was determined</h3>
      <p className={styles.rule}>{claim.ruleDescription}</p>
      {note && <p className={styles.rule}>{note}</p>}

      <h3 className={styles.sectionHeading}>Input facts</h3>
      <ul className={styles.inputs}>
        {claim.inputFactIds.map((id) => {
          const f = index.facts[id];
          if (!f) return null;
          const { label, value } = factHeadline(f, index.episodes);
          const doc = index.documents[f.source.documentId];
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.inputButton}
                onClick={() => onOpenFact(id)}
              >
                <span className={styles.inputHeadline}>
                  {label} — {value}
                </span>
                <span className={styles.inputSource}>
                  {doc ? documentShortLabel(doc) : "Unknown document"} · page{" "}
                  {f.source.page}
                </span>
              </button>
              <blockquote className={styles.excerpt}>
                {f.source.verifiedExcerpt}
              </blockquote>
            </li>
          );
        })}
      </ul>
      <p className={styles.excerptNote}>
        Open an input to inspect its document and source location.
      </p>
    </div>
  );
}
