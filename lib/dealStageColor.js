import { colors } from "../theme/colors";

/** DEAL_STAGES is a fixed 5-value enum (New/Qualified/Proposal/Won/Lost) — see starterkit's shared/db/schema/organization.ts — so this can map every value explicitly, unlike statusColor.js's per-document-type heuristic. */
export function dealStageColor(stage) {
  switch (stage) {
    case "Won":
      return colors.success;
    case "Lost":
      return colors.danger;
    case "Proposal":
      return colors.primary;
    default:
      return colors.textMuted;
  }
}
