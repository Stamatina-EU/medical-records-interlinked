/** A count with its noun: `plural(1, "source document")` → "1 source document", `plural(6, …)` → "6 source documents". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
