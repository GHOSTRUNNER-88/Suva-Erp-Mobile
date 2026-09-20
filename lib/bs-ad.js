/**
 * Plain-JS port of starterkit/shared/date/bs-ad.ts — same underlying
 * engine (@sajanm/nepali-functions, DOM-free, safe here), same function
 * names/behavior, so BS<->AD conversion never drifts between web and
 * mobile (../AGENTS.md §4: "pick one conversion library/utility... so both
 * apps convert dates the same way"). A literal shared file isn't possible
 * across a Next.js app and an Expo app without a shared package, so this
 * is a same-to-same port, not a reinvention — keep it in sync with the
 * desktop file if either changes.
 */
import nf from "@sajanm/nepali-functions";

const ISO_FORMAT = "YYYY-MM-DD";

/** Returns today's calendar date in the application timezone, not UTC. */
export function todayIsoAd() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Returns an AD ISO date shifted by a whole number of calendar days. */
export function addIsoAdDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Converts an ISO "YYYY-MM-DD" AD date string to BS ({year,month,day}). */
export function isoAdToBs(isoDate) {
  const result = nf.AD2BS(isoDate, ISO_FORMAT);
  return typeof result === "string" ? parseIso(result) : null;
}

/** Converts an ISO "YYYY-MM-DD" BS date string to an AD ISO date string. */
export function isoBsToIsoAd(isoBsDate) {
  const result = nf.BS2AD(isoBsDate, ISO_FORMAT, ISO_FORMAT);
  return typeof result === "string" ? result : null;
}

export function isoAdToIsoBs(isoAdDate) {
  const result = nf.AD2BS(isoAdDate, ISO_FORMAT, ISO_FORMAT);
  return typeof result === "string" ? result : null;
}

export function isValidBsDate(bs) {
  return typeof bs === "string" ? nf.BS.ValidateDate(bs, ISO_FORMAT) : nf.BS.ValidateDate(bs);
}

export function getCurrentBsDate() {
  return nf.BS.GetCurrentDate();
}

/**
 * Returns the AD ISO string ("YYYY-MM-DD") of the Nepali fiscal year start date
 * (Shrawan 1 / साउन १ of the Bikram Sambat fiscal year containing the given date or today).
 * Per AGENTS.md §4 & Nepal accounting convention, opening balances always anchor to Shrawan 1.
 */
export function getNepaliFiscalYearStartAd(forIsoAdDate) {
  const cd = forIsoAdDate ? isoAdToBs(forIsoAdDate) : getCurrentBsDate();
  const bs = cd ?? getCurrentBsDate();
  const fyStartYear = bs.month >= 4 ? bs.year : bs.year - 1;
  const bsStartIso = `${fyStartYear}-04-01`;
  const adStart = isoBsToIsoAd(bsStartIso);
  return adStart ?? `${fyStartYear - 57}-07-16`;
}

/**
 * Returns the BS ISO string ("YYYY-04-01") of the Nepali fiscal year start date
 * (Shrawan 1 of the Bikram Sambat fiscal year containing the given date or today).
 */
export function getNepaliFiscalYearStartBs(forIsoAdDate) {
  const cd = forIsoAdDate ? isoAdToBs(forIsoAdDate) : getCurrentBsDate();
  const bs = cd ?? getCurrentBsDate();
  const fyStartYear = bs.month >= 4 ? bs.year : bs.year - 1;
  return `${fyStartYear}-04-01`;
}

/**
 * Returns the BS ISO string ("YYYY-MM-DD") of the Nepali fiscal year end date
 * (Ashadh end / असार मसान्त of the Bikram Sambat fiscal year, month 3).
 */
export function getNepaliFiscalYearEndBs(forIsoAdDate) {
  const cd = forIsoAdDate ? isoAdToBs(forIsoAdDate) : getCurrentBsDate();
  const bs = cd ?? getCurrentBsDate();
  const fyStartYear = bs.month >= 4 ? bs.year : bs.year - 1;
  const fyEndYear = fyStartYear + 1;
  const daysInAshadh = getBsDaysInMonth(fyEndYear, 3);
  return `${fyEndYear}-03-${String(daysInAshadh).padStart(2, "0")}`;
}

/**
 * Returns the AD ISO string ("YYYY-MM-DD") of the Nepali fiscal year end date
 * (Ashadh end in Bikram Sambat converted to Gregorian AD).
 */
export function getNepaliFiscalYearEndAd(forIsoAdDate) {
  const bsEndIso = getNepaliFiscalYearEndBs(forIsoAdDate);
  const adEnd = isoBsToIsoAd(bsEndIso);
  return adEnd ?? `${Number(bsEndIso.slice(0, 4)) - 57}-07-15`;
}

/**
 * Checks whether an AD date string ("YYYY-MM-DD") falls within the Nepali fiscal year.
 */
export function isDateWithinFiscalYear(
  isoAdDate,
  fyStartAd = getNepaliFiscalYearStartAd(),
  fyEndAd = getNepaliFiscalYearEndAd(),
) {
  return isoAdDate >= fyStartAd && isoAdDate <= fyEndAd;
}

/** BS months don't all have the same day count, and it varies by year — never assume 30/31. */
export function getBsDaysInMonth(year, month) {
  return nf.BS.GetDaysInMonth(year, month);
}

export function getBsMinMaxYear() {
  return { min: nf.BS.MinimumDate().year, max: nf.BS.MaximumDate().year };
}

export const BS_MONTH_NAMES_EN = nf.BS.GetMonths();
export const BS_MONTH_NAMES_NE = nf.BS.GetMonthsInUnicode();

/** Formats a BS date for display, e.g. "2 Bhadra 2083" (en) or Unicode Nepali (ne). */
export function formatBsDate(bs, language = "en") {
  const isoString = `${bs.year}-${pad(bs.month)}-${pad(bs.day)}`;
  const formatted = nf.BS.GetFullDate(isoString, language === "ne", ISO_FORMAT);
  return formatted ?? isoString;
}

export function toIso(cd) {
  return `${cd.year}-${pad(cd.month)}-${pad(cd.day)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
