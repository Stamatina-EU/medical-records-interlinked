/**
 * How a documented medication status is shown to people. The stored status stays "Current";
 * it reads as "Ongoing" everywhere in the UI and the Doctor Summary.
 */
import type { MedicationStatus } from "@/lib/model/types";

export function statusLabel(status: MedicationStatus): string {
  return status === "Current" ? "Ongoing" : status;
}
