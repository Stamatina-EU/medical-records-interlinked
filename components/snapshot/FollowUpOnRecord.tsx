/**
 * "Follow-up on record" — personal record information carried forward from source documents.
 * Neutral and source-backed: no "to do", "needs attention" or "to check".
 */
import type { FollowUp } from "@/lib/model/types";
import type { EvidenceIndex } from "@/lib/evidence/index";
import type { SnapshotView } from "@/lib/view/snapshot";
import { formatDate } from "@/lib/text/dates";
import { ChevronIcon } from "@/components/shell/icons";
import { CalculatedLabel, FactValue } from "@/components/ui/EvidenceLinks";
import styles from "./snapshot.module.css";

export default function FollowUpOnRecord({ items, index }: { items: SnapshotView["followUpsOnRecord"]; index: EvidenceIndex }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.module} aria-labelledby="followup-heading">
      <div className={styles.moduleHead}>
        <h2 id="followup-heading" className={styles.moduleTitle}>
          Follow-up on record
        </h2>
        <p className={styles.moduleNote}>Carried forward from your documents</p>
      </div>
      <ul className={styles.list}>
        {items.map(({ factId, matchKey }) => {
          const fu = index.facts[factId] as FollowUp;
          const doc = index.documents[fu.source.documentId];
          return (
            <li key={factId} className={styles.listItem}>
              <FactValue factId={fu.id} className={styles.listButton}>
                <span className={styles.listText}>
                  <span className={styles.listTitle}>{fu.recommendation}</span>
                  <span className={styles.listMeta}>
                    Recommended {formatDate(fu.recommendedOn)}
                    {doc ? ` · from your ${doc.title.toLowerCase()}` : ""}
                  </span>
                </span>
                <span className={styles.listChevron}>
                  <ChevronIcon />
                </span>
              </FactValue>
              {matchKey && (
                <div className={styles.listClaim}>
                  <CalculatedLabel claimKey={matchKey} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
