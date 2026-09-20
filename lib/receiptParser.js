/**
 * Best-effort heuristics over raw OCR text — never a substitute for the
 * user reviewing/editing before save (../AGENTS.md §5: financial figures
 * must be exact, and this is a guess, not a calculation). No line-item
 * extraction is attempted at all: matching printed receipt text against
 * this org's real catalog items reliably isn't something regex heuristics
 * can do honestly, so Purchase Bill / Sales Invoice scans only prefill the
 * party — line items stay fully manual, same as any non-scanned create.
 */

const TOTAL_LINE_PATTERN = /(grand\s*total|total\s*amount|net\s*amount|amount\s*due|total)\s*[:\-]?\s*(?:rs\.?|npr)?\s*([\d,]+\.?\d*)/i;
const NUMBER_TOKEN_PATTERN = /\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g;

export function extractAmount(rawText) {
  const totalMatch = rawText.match(TOTAL_LINE_PATTERN);
  if (totalMatch) {
    const value = Number(totalMatch[2].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  // Fallback: the largest currency-like number on the receipt is usually
  // the grand total (line items and subtotals are smaller than it).
  const tokens = rawText.match(NUMBER_TOKEN_PATTERN) ?? [];
  const values = tokens.map((token) => Number(token.replace(/,/g, ""))).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : null;
}

/** Case-insensitive substring match against this org's real party list — longest name wins so a short/common name (e.g. "KC") can't shadow a longer, more specific match found in the same text. */
export function matchParty(rawText, parties) {
  const haystack = rawText.toLowerCase();
  let best = null;
  for (const party of parties) {
    const name = (party.name || "").trim();
    if (name.length < 3) continue;
    if (haystack.includes(name.toLowerCase())) {
      if (!best || name.length > best.name.length) best = party;
    }
  }
  return best;
}
