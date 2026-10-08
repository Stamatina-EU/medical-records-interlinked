/**
 * A genuinely empty record: no source document and no fact. Only then do Home, History and the Doctor Summary
 * show their first-use states. The seeded demo (six synthetic documents) never does.
 */
import type { TrustedState } from "@/lib/model/types";

export function isEmptyRecord(state: TrustedState): boolean {
  return state.documents.length === 0 && state.facts.length === 0;
}
