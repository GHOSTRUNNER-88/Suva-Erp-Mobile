/**
 * DISPLAY-ONLY totals estimate for the create forms.
 *
 * The authoritative numbers are always recomputed server-side by the same
 * computeLinesAndTotals() desktop uses (../AGENTS.md §5) — nothing here is
 * ever posted, and every screen labels the result as an estimate. The point
 * of this file is that the live preview follows the SAME order of
 * operations desktop's document-form shows, so the estimate and the saved
 * document agree to the rupee in the normal case:
 *
 *   line: gross = qty × rate → line discount → line amount   (2 dp)
 *   subtotal = Σ line amounts                                 (2 dp)
 *   header discount (percent of subtotal, or flat)           (2 dp)
 *   taxable = subtotal − header discount                     (2 dp)
 *   VAT = taxable × vat%                                      (2 dp)
 *   total = taxable + VAT                                     (2 dp)
 */
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toNumber(value, fallback = 0) {
  if (value === "" || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** { gross, discount, amount } for one line. */
export function estimateLine(line) {
  const quantity = toNumber(line?.quantity);
  const rate = toNumber(line?.rate);
  const gross = round2(quantity * rate);
  const discValue = toNumber(line?.discValue);
  const discount = line?.discType === "amount" ? round2(discValue) : round2((gross * discValue) / 100);
  const amount = round2(Math.max(gross - discount, 0));
  return { gross, discount, amount };
}

export function estimateDocumentTotals(lines = [], header = {}) {
  const subtotal = round2(lines.reduce((sum, line) => sum + estimateLine(line).amount, 0));
  const headerValue = toNumber(header.discValue);
  const discAmount = header.discType === "amount" ? round2(headerValue) : round2((subtotal * headerValue) / 100);
  const taxableAmount = round2(Math.max(subtotal - discAmount, 0));
  const vatPercent = header.isVatApplicable ? toNumber(header.vatPercent) : 0;
  const vatAmount = header.isVatApplicable ? round2((taxableAmount * vatPercent) / 100) : 0;
  const totalAmount = round2(taxableAmount + vatAmount);
  return { subtotal, discAmount, taxableAmount, vatAmount, totalAmount };
}

/** Expense: taxable + non-taxable, VAT only on the taxable part — same shape desktop's expense modal previews. */
export function estimateExpenseTotal({ taxableAmount, nonTaxableAmount, isVatApplicable, vatPercent }) {
  const taxable = round2(toNumber(taxableAmount));
  const nonTaxable = round2(toNumber(nonTaxableAmount));
  const vat = isVatApplicable ? round2((taxable * toNumber(vatPercent)) / 100) : 0;
  return { taxable, nonTaxable, vatAmount: vat, totalAmount: round2(taxable + nonTaxable + vat) };
}

/** Shared numeric validators for amount-like inputs ("" counts as 0 unless `required`). */
export function isNonNegativeNumber(value) {
  if (value === "" || value == null) return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function isPercent(value) {
  if (value === "" || value == null) return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
