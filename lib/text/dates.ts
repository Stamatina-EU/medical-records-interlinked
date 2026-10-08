/** Small date helpers shared by the verifier and the UI. All dates are ISO `YYYY-MM-DD`. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "2026-09-25" -> "25 Sep 2026" (the format used throughout the synthetic corpus and UI). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * A date span, shown as one date when both ends read the same: ("2026-09-25", "2026-09-25") -> "25 Sep 2026",
 * ("2025-03-14", "2026-09-25") -> "14 Mar 2025 to 25 Sep 2026". `format` and `separator` let month-level spans
 * ("Mar 2025 – Jan 2026") follow the same rule.
 */
export function formatSpan(fromIso: string, toIso: string, format: (iso: string) => string = formatDate, separator = " to "): string {
  const from = format(fromIso);
  const to = format(toIso);
  return from === to ? from : `${from}${separator}${to}`;
}

/** ISO date-time -> "1 Sep 2026, 12:00" in local time (same month style as formatDate). */
export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whole calendar months from `fromIso` to `toIso` (never negative). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  return Math.max(0, months);
}
