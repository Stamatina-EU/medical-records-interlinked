/**
 * Metadata for an ADDED document. Pure.
 * The displayed title must come from the document itself: the model's `documentType` is only a
 * search key — if it is found in the page text, the title is cut from that text; otherwise a
 * neutral fallback is used. The date is the verified document date.
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

function classify(text: string): DocumentType {
  const n = normalize(text);
  if (n.includes("prescription")) return "prescription";
  if (/(imaging|ultrasound|x-ray|radiolog|mri|ct scan)/.test(n)) return "imaging_report";
  if (/(laborator|lab report|pathology)/.test(n)) return "lab_report";
  return "consultation_note";
}

const FALLBACK_TITLE: Record<DocumentType, string> = {
  prescription: "Prescription",
  imaging_report: "Imaging Report",
  lab_report: "Laboratory Report",
  consultation_note: "Consultation Note",
};

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
  const type = classify(span ?? extractedType);
  return {
    id: documentId,
    title: span ? titleCase(span) : FALLBACK_TITLE[type],
    documentType: type,
    issuer: "", // not extracted — the drawer shows how the document was added instead
    date: verifiedDate,
    file: `${documentId}.pdf`,
    pageCount: pages.length,
    origin: "added",
  };
}
