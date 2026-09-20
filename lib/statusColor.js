import { colors } from "../theme/colors";

/** Small, honest heuristic — we don't know starterkit's exact status enum per document type, so this only special-cases the two ends (clearly cancelled / clearly settled) and falls back to primary rather than guessing. */
export function statusColor(status) {
  const value = (status || "").toLowerCase();
  if (["cancelled", "void", "voided", "rejected"].includes(value)) return colors.danger;
  if (["completed", "paid", "posted", "approved", "cleared"].includes(value)) return colors.success;
  return colors.primary;
}
