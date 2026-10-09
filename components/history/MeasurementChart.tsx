/**
 * Ferritin across time — a single-series line. Each point carries the reference range supplied
 * WITH that result as its own faint band (laboratories differ, so there is no shared "normal"
 * band). Recessive axes, one functional colour, a direct label on the latest point only,
 * a native per-point tooltip, and the measurement rows below are the table view.
 * No status colours, no judgement.
 */
import type { LabMeasurement } from "@/lib/model/types";
import { formatDate } from "@/lib/text/dates";
import styles from "./history.module.css";

/* Drawn at two native sizes so text stays readable (~12px) on phones instead of scaling down. */
const SIZES = {
  wide: {
    W: 720,
    H: 240,
    PAD: { top: 20, right: 56, bottom: 34, left: 44 },
    band: 14,
  },
  narrow: {
    W: 340,
    H: 220,
    PAD: { top: 22, right: 34, bottom: 32, left: 30 },
    band: 10,
  },
} as const;

function niceCeil(v: number): number {
  const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 1000) * 1000;
}

type Props = { series: LabMeasurement[]; latestUpdatedId: string | null };

function Plot({
  series,
  latestUpdatedId,
  size,
}: Props & { size: keyof typeof SIZES }) {
  const { W, H, PAD, band: bandW } = SIZES[size];
  const t = series.map((m) => new Date(`${m.measuredOn}T00:00:00Z`).getTime());
  const t0 = Math.min(...t);
  const t1 = Math.max(...t);
  // y domain from the VALUES (and range lower bounds), so small values aren't flattened by a 400 upper bound
  const yMax = niceCeil(
    Math.max(...series.map((m) => Math.max(m.value, m.refLow ?? 0))) * 1.35,
  );
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (t1 === t0 ? plotW / 2 : ((t[i] - t0) / (t1 - t0)) * plotW);
  const y = (v: number) => PAD.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const ticks = [0, yMax / 2, yMax];
  const last = series.length - 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={
        size === "wide"
          ? `${styles.chart} ${styles.chartWide}`
          : `${styles.chart} ${styles.chartNarrow}`
      }
      role="img"
      aria-label={`Ferritin results over time: ${series.map((m) => `${m.value} ${m.unit} on ${formatDate(m.measuredOn)}`).join("; ")}. Values are listed in the dated record below.`}
    >
      {/* recessive grid + y axis labels */}
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            className={styles.grid}
          />
          <text
            x={PAD.left - 8}
            y={y(v) + 4}
            textAnchor="end"
            className={styles.axisText}
          >
            {v}
          </text>
        </g>
      ))}

      {/* per-result supplied range bands */}
      {series.map((m, i) =>
        m.refLow !== null && m.refHigh !== null ? (
          <g key={`band-${m.id}`}>
            <rect
              x={x(i) - bandW / 2}
              y={y(m.refHigh)}
              width={bandW}
              height={Math.max(2, y(m.refLow) - y(m.refHigh))}
              rx={4}
              className={styles.band}
            />
            {m.refHigh > yMax && (
              <text
                x={x(i)}
                y={PAD.top - 6}
                textAnchor="middle"
                className={styles.bandCap}
              >
                ↑ {m.refHigh}
              </text>
            )}
          </g>
        ) : null,
      )}

      {/* the series */}
      <polyline
        points={series.map((m, i) => `${x(i)},${y(m.value)}`).join(" ")}
        className={styles.line}
      />
      {series.map((m, i) => (
        <g key={m.id}>
          <circle
            cx={x(i)}
            cy={y(m.value)}
            r={m.id === latestUpdatedId ? 6 : 5}
            className={
              m.id === latestUpdatedId ? styles.pointLatest : styles.point
            }
          >
            <title>{`Ferritin ${m.value} ${m.unit} · ${formatDate(m.measuredOn)}${m.refText ? ` · supplied range ${m.refText} ${m.unit}` : ""}`}</title>
          </circle>
          <text
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            className={styles.axisText}
          >
            {formatDate(m.measuredOn).split(" ").slice(1).join(" ")}
          </text>
        </g>
      ))}
      {/* direct label: latest point only */}
      <text
        x={x(last) + 10}
        y={y(series[last].value) + 4}
        className={styles.pointLabel}
      >
        {series[last].value}
      </text>
    </svg>
  );
}

export default function MeasurementChart({ series, latestUpdatedId }: Props) {
  if (series.length === 0) return null;
  return (
    <figure className={styles.chartFigure}>
      <Plot series={series} latestUpdatedId={latestUpdatedId} size="wide" />
      <Plot series={series} latestUpdatedId={latestUpdatedId} size="narrow" />
      <figcaption className={styles.chartCaption}>
        <span className={styles.bandKey} aria-hidden="true" /> Each band is the
        reference range supplied with that result. Ranges differ between
        laboratories, so each result is compared only with its own.
      </figcaption>
    </figure>
  );
}
