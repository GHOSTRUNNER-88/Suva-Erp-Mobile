import i18next from "../i18n/index.js";
import { toNepaliDigits } from "./nepaliDigits.js";

/**
 * Minimal relative time formatter supporting English and Nepali numerals.
 */
export function relativeTime(isoString) {
  if (!isoString) return "";
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const isNepali = (i18next.language || "").toLowerCase().startsWith("ne");
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return isNepali ? "भर्खरै" : "just now";
  if (minutes < 60) return isNepali ? `${toNepaliDigits(minutes)} मिनेट अघि` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isNepali ? `${toNepaliDigits(hours)} घण्टा अघि` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isNepali ? `${toNepaliDigits(days)} दिन अघि` : `${days}d ago`;
}
