/**
 * The headline of a proposed (verified, not yet approved) fact in the review panel.
 * A medication is named by its episode: the one already in the record, or — on a first record, before any episode
 * exists — the code-owned supported episode the verifier matched it to (lib/extraction/lexicon.ts). The name is
 * never inferred from the document.
 */
import type { Proposal, TrustedState } from "@/lib/model/types";
import { knownEpisodes } from "@/lib/extraction/lexicon";
import { formatDate } from "@/lib/text/dates";
import { statusLabel } from "@/lib/text/status";

export function reviewFactHeadline(f: Proposal["facts"][number], state: TrustedState): { label: string; value: string } {
  if (f.kind === "lab_measurement") {
    return {
      label: "Ferritin",
      value: `${f.value} ${f.unit}${f.refText ? ` · supplied range ${f.refText} ${f.unit}` : ""} · ${formatDate(f.measuredOn)}`,
    };
  }
  const name = (knownEpisodes(state.episodes).find((ep) => ep.id === f.episodeId)?.name ?? "Medication").split(" (")[0];
  return { label: name, value: `${statusLabel(f.status)} · documented ${formatDate(f.documentedOn)}` };
}
