/**
 * Summary Composer — the Doctor Summary, composed deterministically from approved facts and
 * derived claims. Pure; NO AI. Spec: `spec.md > Summary Composer`; PRD: `prd.md > Doctor Summary`.
 *
 * Rules:
 *  - a section appears only when it has at least one supported statement
 *  - every statement carries evidence refs (source facts or derived claims)
 *  - never writes absence ("No current medications", "no later result")
 *  - never uses a diagnostic label; only documented values, statuses and recommendations
 *  - source numbers follow the order documents are first cited
 */
import type { CalculatedClaim, DocumentRecord, FollowUp, ImagingExam, SourceFact, TrustedState } from "@/lib/model/types";
import { ferritinSeries, followUps, medicationEvents } from "@/lib/engine/derive";
import { formatDate } from "@/lib/text/dates";

export type SummaryRef = { type: "fact"; id: string } | { type: "claim"; key: string };
export type Statement = { text: string; refs: SummaryRef[]; derived: boolean; updated: boolean };
export type SummarySection = { id: string; title: string; statements: Statement[] };
export type SourceEntry = { n: number; document: DocumentRecord };
export type DoctorSummary = {
  patientName: string;
  /** date of the most recent source document — not the render time */
  latestSourceDate: string;
  documentCount: number;
  sections: SummarySection[];
  sources: SourceEntry[];
  /** evidence ref -> source numbers, for the chips */
  sourceNumbers: Record<string, number[]>;
};

const refKey = (r: SummaryRef) => (r.type === "fact" ? `fact:${r.id}` : `claim:${r.key}`);

export function composeDoctorSummary(state: TrustedState, claims: CalculatedClaim[]): DoctorSummary {
  const factById = new Map(state.facts.map((f) => [f.id, f] as [string, SourceFact]));
  const claimByKey = new Map(claims.map((c) => [c.key, c]));
  const affected = new Set(state.latestUpdate?.affected ?? []);
  const fact = (id: string) => ({ type: "fact", id }) as SummaryRef;
  const claim = (key: string) => ({ type: "claim", key }) as SummaryRef;
  const stmt = (text: string, refs: SummaryRef[], derived = false): Statement => ({
    text,
    refs,
    derived,
    updated: refs.some((r) => affected.has(r.type === "fact" ? r.id : r.key)),
  });

  const sections: SummarySection[] = [];
  const series = ferritinSeries(state);

  // A. Relevant documented history
  if (series.length >= 2) {
    const first = series[0];
    const last = series[series.length - 1];
    sections.push({
      id: "history",
      title: "Relevant documented history",
      statements: [
        stmt(
          `Ferritin has been measured ${series.length} times in the documented record, including ${first.value} ${first.unit} on ${formatDate(first.measuredOn)} and ${last.value} ${last.unit} on ${formatDate(last.measuredOn)}.`,
          // the count depends on every measurement, so every measurement is cited
          series.map((m) => fact(m.id)),
        ),
      ],
    });
  }

  // B. Recent investigations
  if (series.length >= 1) {
    const m = series[series.length - 1];
    const statements = [
      stmt(
        `Ferritin — ${m.value} ${m.unit}${m.refText ? ` · supplied reference range ${m.refText} ${m.unit}` : ""} · ${formatDate(m.measuredOn)}.`,
        [fact(m.id)],
      ),
    ];
    const range = claimByKey.get(`range:${m.id}`);
    if (range) statements.push(stmt(`${range.text} (compared only with the range supplied with this result).`, [claim(range.key)], true));
    sections.push({ id: "investigations", title: "Recent investigations", statements });
  }

  // C. Medication / recent treatment — explicit status events only
  const treatment: Statement[] = [];
  const current: Statement[] = [];
  for (const ep of state.episodes) {
    const events = medicationEvents(state, ep.id);
    if (events.length === 0) continue;
    const latest = events[events.length - 1];
    const doc = state.documents.find((d) => d.id === latest.source.documentId);
    const earlier = events.slice(0, -1);
    const history = earlier.length
      ? ` Earlier: ${earlier.map((e) => `${e.status}, documented ${formatDate(e.documentedOn)}`).join("; ")}.`
      : "";
    const line = stmt(
      `${ep.name} — ${latest.status}. Status documented in ${doc ? doc.title.toLowerCase() : "a record"} dated ${formatDate(latest.documentedOn)}.${history}`,
      [...earlier.map((e) => fact(e.id)), fact(latest.id)],
    );
    (latest.status === "Current" ? current : treatment).push(line);
  }
  if (current.length) sections.push({ id: "current-medication", title: "Current medication", statements: current });
  if (treatment.length) sections.push({ id: "treatment", title: "Medication / recent treatment", statements: treatment });

  // D. Documented follow-up (never states absence)
  const fuStatements: Statement[] = [];
  for (const fu of followUps(state, "iron")) {
    fuStatements.push(stmt(`Ferritin recheck recommended on ${formatDate(fu.recommendedOn)}: "${fu.recommendation}"`, [fact(fu.id)]));
    const match = claimByKey.get(`followup-match:${fu.id}`);
    if (match) {
      const result = factById.get(match.inputFactIds[1]);
      const when = result && result.kind === "lab_measurement" ? ` (${formatDate(result.measuredOn)})` : "";
      fuStatements.push(stmt(`A later approved ferritin result has been found${when}.`, [claim(match.key)], true));
    }
  }
  if (fuStatements.length) sections.push({ id: "follow-up", title: "Documented follow-up", statements: fuStatements });

  // E. Imaging follow-up — only what the reports state
  const exams = state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  if (exams.length) {
    const latest = exams[exams.length - 1];
    const earlierDoc = latest.comparesToDocumentId ? state.documents.find((d) => d.id === latest.comparesToDocumentId) : undefined;
    const imaging: Statement[] = [
      stmt(
        `${latest.examName}, ${formatDate(latest.performedOn)}${earlierDoc ? `, compared with the examination of ${formatDate(earlierDoc.date)} (as stated in the report)` : ""}.`,
        [fact(latest.id)],
      ),
    ];
    const recs = followUps(state, "imaging");
    const rec: FollowUp | undefined = recs[recs.length - 1];
    if (rec) imaging.push(stmt(`Documented recommendation (${formatDate(rec.recommendedOn)}): "${rec.recommendation}"`, [fact(rec.id)]));
    sections.push({ id: "imaging", title: "Imaging follow-up", statements: imaging });
  }

  // Source numbering by first citation
  const docOrder: string[] = [];
  const sourceNumbers: Record<string, number[]> = {};
  const docsOf = (r: SummaryRef): string[] => {
    if (r.type === "fact") {
      const f = factById.get(r.id);
      return f ? [f.source.documentId] : [];
    }
    const c = claimByKey.get(r.key);
    return c ? c.inputFactIds.map((id) => factById.get(id)?.source.documentId).filter((d): d is string => !!d) : [];
  };
  for (const s of sections) {
    for (const st of s.statements) {
      for (const r of st.refs) {
        const nums: number[] = [];
        for (const d of docsOf(r)) {
          if (!docOrder.includes(d)) docOrder.push(d);
          const n = docOrder.indexOf(d) + 1;
          if (!nums.includes(n)) nums.push(n);
        }
        sourceNumbers[refKey(r)] = nums.sort((a, b) => a - b);
      }
    }
  }

  return {
    patientName: state.patient.displayName,
    latestSourceDate: state.documents.map((d) => d.date).reduce((a, b) => (b > a ? b : a)),
    documentCount: state.documents.length,
    sections,
    sources: docOrder.map((id, i) => ({ n: i + 1, document: state.documents.find((d) => d.id === id)! })),
    sourceNumbers,
  };
}

export { refKey };
