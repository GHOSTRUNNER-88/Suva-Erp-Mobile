/** Display-label helpers shared by the create forms' pickers. Pure formatting, no logic. */

/** "Nabil Bank — Main account" / "Cash" — same label desktop's bank-account select shows (displayName || bankName). */
export function bankAccountLabel(account) {
  if (!account) return "";
  if (account.displayName && account.bankName && account.displayName !== account.bankName) return `${account.bankName} — ${account.displayName}`;
  return account.displayName || account.bankName || account.name || "";
}

/** Unit code when the API sent one (desktop's line unit select shows codes), else the unit name. */
export function unitLabel(unit) {
  if (!unit) return "";
  return unit.code || unit.name || "";
}
