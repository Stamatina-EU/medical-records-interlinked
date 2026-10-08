/**
 * History — one longitudinal topic across time, through one reusable template.
 * Spec: `spec.md > History Page (Topic Template)`; PRD: `prd.md > History (topic template)`.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { readState, StateCorruptedError } from "@/lib/store/stateStore";
import { derive } from "@/lib/engine/derive";
import { buildEvidenceIndex } from "@/lib/evidence/index";
import { historyView, TOPICS, type Topic } from "@/lib/view/history";
import { formatSpan } from "@/lib/text/dates";
import EvidenceProvider from "@/components/evidence/EvidenceProvider";
import { ImagingHistory, IronHistory } from "@/components/history/HistorySections";
import StateError from "@/components/ui/StateError";
import { isEmptyRecord } from "@/lib/view/emptyRecord";
import styles from "@/components/history/history.module.css";

export const dynamic = "force-dynamic";

const SUBTITLE: Record<Topic, string> = {
  iron: "Your ferritin results, treatment and follow-up across time",
  imaging: "Your imaging examinations and documented follow-up across time",
};

export default async function HistoryPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!TOPICS.some((t) => t.topic === topic)) notFound();

  let state;
  try {
    state = await readState();
  } catch (err) {
    if (err instanceof StateCorruptedError) return <StateError />;
    throw err;
  }

  // a genuinely empty record has no history to show yet (never the case for the seeded demo)
  if (isEmptyRecord(state)) {
    return (
      <main className="page">
        <header className={styles.header}>
          <Link href="/" className={styles.back}>
            ← Home
          </Link>
          <h1 className={styles.title}>History</h1>
        </header>
        <p className={styles.emptyNote}>
          No history yet. <Link href="/">Add your first record on Home.</Link>
        </p>
      </main>
    );
  }

  const claims = derive(state);
  const index = buildEvidenceIndex(state, claims);
  const view = historyView(state, claims, topic as Topic);
  const span = view.firstDate && view.lastDate ? formatSpan(view.firstDate, view.lastDate) : null;

  return (
    <EvidenceProvider index={index}>
      <main className="page">
        <header className={styles.header}>
          <Link href="/" className={styles.back}>
            ← Home
          </Link>
          <h1 className={styles.title}>{view.title}</h1>
          <p className={styles.subtitle}>
            {SUBTITLE[view.topic]}
            {span ? ` · ${span}` : ""}
          </p>
          <nav className={styles.switcher} aria-label="History topics">
            {TOPICS.map((t) => (
              <Link
                key={t.topic}
                href={`/history/${t.topic}`}
                className={t.topic === view.topic ? `${styles.switch} ${styles.switchActive}` : styles.switch}
                aria-current={t.topic === view.topic ? "page" : undefined}
              >
                {t.title}
              </Link>
            ))}
          </nav>
        </header>
        {view.topic === "iron" ? <IronHistory view={view} /> : <ImagingHistory view={view} />}
      </main>
    </EvidenceProvider>
  );
}
