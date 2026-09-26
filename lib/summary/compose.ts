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
 *  - Direct = a source states it; Derived = code determines it (counts, ordering, "latest",
 *    matching). A counted or ordered statement is Derived and its claim lists EVERY input
 *  - "Current documented picture" is a 2–5 sentence orientation from the same templates;
 *    medication wording follows only the latest explicitly documented status
 */
import type {
  CalculatedClaim,
  DocumentRecord,
  FollowUp,
  ImagingExam,
  MedicationStatus,
  SourceFact,
  TrustedState,
} from "@/lib/model/types";
import { ferritinSeries, followUps, medicationEvents } from "@/lib/engine/derive";
import { formatDate } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";

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
  /** derived claims made only for this summary (counts, "latest"); the page adds them to the drawer's index */
  claims: CalculatedClaim[];
};

const refKey = (r: SummaryRef) => (r.type === "fact" ? `fact:${r.id}` : `claim:${r.key}`);

export function composeDoctorSummary(state: TrustedState, claims: CalculatedClaim[]): DoctorSummary {
  const factById = new Map(state.facts.map((f) => [f.id, f] as [string, SourceFact]));
  const claimByKey = new Map(claims.map((c) => [c.key, c]));
  const affected = new Set(state.latestUpdate?.affected ?? []);
  // Direct = a source states it. Derived = code determines it from approved facts (counting,
  // ordering, "latest", matching). A statement is never Direct just because its inputs are sourced.
  const summaryClaims: CalculatedClaim[] = [];
  const addClaim = (c: CalculatedClaim) => {
    summaryClaims.push(c);
    claimByKey.set(c.key, c);
    return c.key;
  };
  const fact = (id: string) => ({ type: "fact", id }) as SummaryRef;
  const claim = (key: string) => ({ type: "claim", key }) as SummaryRef;
  const stmt = (text: string, refs: SummaryRef[], derived = false): Statement => ({
    text,
    refs,
    derived,
    updated: refs.some((r) =>
      r.type === "fact" ? affected.has(r.id) : affected.has(r.key) || !!claimByKey.get(r.key)?.inputFactIds.some((id) => affected.has(id)),
    ),
  });

  const sections: SummarySection[] = [];
  const series = ferritinSeries(state);
  const exams = state.facts
    .filter((f): f is ImagingExam => f.kind === "imaging_exam")
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  const latestSourceDate = state.documents.map((d) => d.date).reduce((a, b) => (b > a ? b : a), "");

  // The ferritin count + latest selection is one derived claim, shared by the picture and section A.
  const lastM = series[series.length - 1];
  const seriesKey = lastM
    ? addClaim({
        key: "summary-series:ferritin",
        kind: "series_count",
        text: `${series.length} ferritin ${series.length === 1 ? "measurement" : "measurements"} documented · latest ${lastM.value} ${lastM.unit} on ${formatDate(lastM.measuredOn)}`,
        ruleDescription:
          "Counted every approved ferritin result in your record and ordered them by measurement date; the latest is the one with the most recent date. No document states this count or which result is the latest.",
        inputFactIds: series.map((m) => m.id),
      })
    : null;

  // Current documented picture — orientation only; every sentence from the templates below.
  const picture: Statement[] = [];
  if (seriesKey) {
    picture.push(
      stmt(
        series.length === 1
          ? `One ferritin measurement is documented: ${lastM.value} ${lastM.unit} on ${formatDate(lastM.measuredOn)}.`
          : `${cap(numberWord(series.length))} ferritin measurements are documented, most recently ${lastM.value} ${lastM.unit} on ${formatDate(lastM.measuredOn)}.`,
        [claim(seriesKey)],
        true,
      ),
    );
    const below = series.filter((m) => m.refLow !== null && m.value < m.refLow);
    if (below.length >= 2) {
      // the count is over the whole series, so every measurement is an input
      const key = addClaim({
        key: "summary-below-range:ferritin",
        kind: "below_range_count",
        text: `${below.length} of ${series.length} ferritin results below the range supplied with that result`,
        ruleDescription:
          "Compared each approved ferritin result only with the reference range supplied with that same result, across every ferritin result in your record. This is a comparison, not a diagnosis.",
        inputFactIds: series.map((m) => m.id),
      });
      picture.push(
        stmt(
          `${cap(numberWord(below.length))} of ${numberWord(series.length)} ferritin results are below the laboratory range supplied with that result (${below.map((m) => formatDate(m.measuredOn)).join(", ")}).`,
          [claim(key)],
          true,
        ),
      );
    }
  }
  for (const ep of state.episodes) {
    const events = medicationEvents(state, ep.id);
    if (events.length === 0) continue;
    // Direct: the latest status event's own source states this status explicitly
    const latest = events[events.length - 1];
    picture.push(stmt(`${ep.name} is documented as ${STATUS_WORD[latest.status]}.`, [fact(latest.id)]));
  }
  for (const fu of followUps(state, "iron")) {
    const match = claimByKey.get(`followup-match:${fu.id}`);
    // "matching" is about the kind of test, never about timing
    if (match) picture.push(stmt("A later ferritin result matching the recommended test is documented.", [claim(match.key)], true));
  }
  for (const examName of [...new Set(exams.map((x) => x.examName))]) {
    const ofName = exams.filter((x) => x.examName === examName);
    const latest = ofName[ofName.length - 1];
    if (ofName.length >= 2) {
      const key = addClaim({
        key: `summary-latest-exam:${examName}`,
        kind: "latest_exam",
        text: `Latest documented ${lowerFirst(examName)} · ${formatDate(latest.performedOn)}`,
        ruleDescription: `Ordered every approved ${lowerFirst(examName)} in your record by examination date and took the most recent. No document states which examination is the latest.`,
        inputFactIds: ofName.map((x) => x.id),
      });
      picture.push(stmt(`The latest documented ${lowerFirst(examName)} is dated ${formatDate(latest.performedOn)}.`, [claim(key)], true));
    } else {
      picture.push(stmt(`A ${lowerFirst(examName)} dated ${formatDate(latest.performedOn)} is documented.`, [fact(latest.id)]));
    }
    const earlierDoc = latest.comparesToDocumentId ? state.documents.find((d) => d.id === latest.comparesToDocumentId) : undefined;
    // Direct: the report itself states the comparison
    if (earlierDoc)
      picture.push(
        stmt(`The ${formatDate(latest.performedOn)} report explicitly compares it with the examination of ${formatDate(earlierDoc.date)}.`, [fact(latest.id)]),
      );
  }
  if (picture.length) sections.push({ id: "picture", title: "Current documented picture", statements: picture });

  // A. Relevant documented history (a count: derived, from the same claim)
  if (seriesKey && series.length >= 2) {
    const first = series[0];
    sections.push({
      id: "history",
      title: "Relevant documented history",
      statements: [
        stmt(
          `Ferritin has been measured ${series.length} times in the documented record, including ${first.value} ${first.unit} on ${formatDate(first.measuredOn)} and ${lastM.value} ${lastM.unit} on ${formatDate(lastM.measuredOn)}.`,
          [claim(seriesKey)],
          true,
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
    // other dated status facts are listed as documented, not ordered ("earlier" would be derived)
    const others = events.slice(0, -1);
    const also = others.length
      ? ` Also documented: ${others.map((e) => `${statusLabel(e.status)}, ${formatDate(e.documentedOn)}`).join("; ")}.`
      : "";
    const line = stmt(
      `${ep.name} — ${statusLabel(latest.status)}. Status documented in ${doc ? doc.title.toLowerCase() : "a record"} dated ${formatDate(latest.documentedOn)}.${also}`,
      [fact(latest.id), ...others.map((e) => fact(e.id))],
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
    latestSourceDate,
    documentCount: state.documents.length,
    sections,
    sources: docOrder.map((id, i) => ({ n: i + 1, document: state.documents.find((d) => d.id === id)! })),
    sourceNumbers,
    claims: summaryClaims,
  };
}

export { refKey };

const STATUS_WORD: Record<MedicationStatus, string> = {
  Prescribed: "prescribed",
  Current: "ongoing",
  Completed: "completed",
  Stopped: "stopped",
};

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numberWord = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
