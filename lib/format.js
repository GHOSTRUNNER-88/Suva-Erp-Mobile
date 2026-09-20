import i18next from "../i18n/index.js";
import { toNepaliDigits } from "./nepaliDigits.js";

export { toNepaliDigits };

/**
 * Formats any number, count, date, or string:
 * When the active language is Nepali ('ne'), converts ASCII 0-9 to Nepali ०-९.
 * When English, preserves standard 0-9.
 */
export function formatNumber(input, options = {}) {
  if (input === null || input === undefined) return "";
  const isNepali = options.forceNepali ?? (i18next.language || "").toLowerCase().startsWith("ne");
  const str = String(input);
  return isNepali ? toNepaliDigits(str) : str;
}

/**
 * Matches the ERP NPR display convention:
 * In English: `Rs 1,000.00`
 * In Nepali: `रु १,०००.००`
 *
 * Formatting only, never used to compute a total — totals always come
 * from the API (AGENTS.md §5).
 */
export function formatNpr(amount, options = {}) {
  const parsed = Number(amount ?? 0);
  const value = Number.isFinite(parsed) ? parsed : 0;
  const isNepali = options.forceNepali ?? (i18next.language || "").toLowerCase().startsWith("ne");

  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNepali) {
    return `रु ${toNepaliDigits(formatted)}`;
  }
  return `Rs ${formatted}`;
}

/**
 * Formats a date or reference number, converting digits to Nepali when active.
 */
export function formatDateNumbers(dateStr) {
  if (!dateStr) return "";
  return formatNumber(dateStr);
}

/**
 * "Only cancelled doesn't count" — the exact scope rule starterkit's own
 * sales-summary report states (shared/reports/definitions/sales-summary.ts:
 * cancelled documents are excluded, drafts are included). Any client-side
 * roll-up of a document list on this side must use the same predicate so a
 * mobile summary card can never disagree with the server's own reports.
 */
export function countsTowardTotals(document) {
  return document?.status !== "cancelled";
}
