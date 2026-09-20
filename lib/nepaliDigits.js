const NE_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/**
 * Converts ASCII digits (0-9) to Nepali Devanagari numerals (०-९).
 * Preserves all other characters (commas, decimals, slashes, dashes, text).
 */
export function toNepaliDigits(input) {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (ch) => NE_DIGITS[ch.charCodeAt(0) - 48] || ch);
}

