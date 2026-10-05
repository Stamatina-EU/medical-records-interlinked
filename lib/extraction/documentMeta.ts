/**
 * Metadata for an ADDED document. Pure.
 * Title and type come only from the document's own text. The model's `documentType` is just a
 * search key: if it is found word for word in the page text, the title is cut from that text and
 * the type is classified from that verified text (or `other`). If it is not found, the suggestion
 * is ignored entirely: title "Added document", type `other`. The date is the verified document date.
 */
import type { DocumentRecord, DocumentType, TrustedState } from "@/lib/model/types";
import { findOriginalSpan, normalize } from "@/lib/text/normalize";

function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Classify VERIFIED source text only; anything unrecognised is `other`, never a guessed type. */
function classify(verifiedText: string): DocumentType {
  const n = normalize(verifiedText);
  if (n.includes("prescription")) return "prescription";
  if (/(imaging|ultrasound|x-ray|radiolog|mri|ct scan)/.test(n)) return "imaging_report";
  if (/(laborator|lab report|pathology)/.test(n)) return "lab_report";
  if (/(consultation|clinic note|visit note)/.test(n)) return "consultation_note";
  return "other";
}

export const UNVERIFIED_TITLE = "Added document";

export function nextDocumentId(state: TrustedState): string {
  const nums = state.documents.map((d) => Number(d.id.replace(/^doc-/, ""))).filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `doc-${String(next).padStart(2, "0")}`;
}

export function addedDocumentRecord(
  pages: string[],
  extractedType: string,
  verifiedDate: string,
  documentId: string,
): DocumentRecord {
  const span = extractedType.trim() ? findOriginalSpan(pages.join("\n"), extractedType) : null;
  return {
    id: documentId,
    title: span ? titleCase(span) : UNVERIFIED_TITLE,
    documentType: span ? classify(span) : "other",
    issuer: "", // not extracted — the drawer shows how the document was added instead
    date: verifiedDate,
    file: `${documentId}.pdf`,
    pageCount: pages.length,
    origin: "added",
  };
}
