/**
 * First use — on a genuinely empty record, Home itself is the start: one sentence and one action, which opens the
 * same Add record flow as always (propose → verify → approve). Not an onboarding page; it disappears with the
 * first approved record.
 */
import AddRecord from "@/components/add-record/AddRecord";
import styles from "./snapshot.module.css";

export default function StartRecord() {
  return (
    <section className={`${styles.surface} ${styles.start}`} aria-labelledby="start-heading">
      <h2 id="start-heading" className={styles.moduleTitle}>
        Start your record
      </h2>
      <p className={styles.startCopy}>
        Add your first medical document (PDF). MRI proposes supported facts, checks each one against the source page,
        and adds only what you approve.
      </p>
      <AddRecord label="Add your first record" />
    </section>
  );
}
