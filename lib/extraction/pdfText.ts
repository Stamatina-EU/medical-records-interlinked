/**
 * PDF Text Reader — PDF bytes -> page text, one string per page. Deterministic, no AI.
 * Spec: `spec.md > PDF Text Reader`.
 *
 * Text is kept AS EXTRACTED (un-normalized): it is the source the canonical
 * `verifiedExcerpt` is cut from. Normalization happens only inside the verifier.
 */
import { extractText, getDocumentProxy } from "unpdf";

export async function readPdfPages(bytes: Uint8Array): Promise<string[]> {
  // unpdf/pdf.js may detach the buffer it is given, so pass a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).map((t) => t ?? "");
}

/** True when the PDF has a usable text layer (a scanned image PDF has none). */
export function hasText(pages: string[]): boolean {
  return pages.some((p) => p.replace(/\s+/g, "").length > 20);
}
