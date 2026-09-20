/**
 * Turns the backend's validation output into on-screen text.
 *
 * Zod messages in starterkit's schemas are i18n *codes* ("partyRequired",
 * "atLeastOneLineRequired", "numberTooLong"), not sentences — desktop
 * renders them as t(`${ns}.${code}`). Mobile does the same: try each
 * screen-specific namespace first, then the shared `forms.errors.*` table,
 * and never show a bare code. A value that already looks like a sentence
 * (spaces, punctuation) is passed through untouched — that's a formError a
 * service composed for a human.
 */
const CODE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export function translateErrorCode(i18n, raw, namespaces = []) {
  if (raw == null) return null;
  const code = String(raw).trim();
  if (!code) return null;
  if (!CODE_RE.test(code)) return code;
  for (const ns of [...namespaces, "forms.errors"]) {
    const key = `${ns}.${code}`;
    if (i18n.exists(key)) return i18n.t(key);
  }
  return i18n.t("forms.errors.somethingWentWrong");
}

/** `{ field: ["code"] | "code" }` → `{ field: "translated sentence" }`. Nested line errors ("lines.0.itemId") collapse onto "lines". */
export function flattenFieldErrors(i18n, fieldErrors, namespaces = []) {
  const flat = {};
  for (const [key, value] of Object.entries(fieldErrors ?? {})) {
    const first = Array.isArray(value) ? value[0] : value;
    const text = translateErrorCode(i18n, first, namespaces);
    if (!text) continue;
    const field = key.startsWith("lines.") || key.startsWith("lines[") ? "lines" : key;
    if (!flat[field]) flat[field] = text;
  }
  return flat;
}

/**
 * One place for the catch block every create screen shares:
 * fieldErrors → per-field map, formError/messageKey → banner text.
 */
export function describeSubmitError(i18n, err, namespaces = []) {
  if (err?.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
    const fields = flattenFieldErrors(i18n, err.fieldErrors, namespaces);
    return { fields, formError: i18n.t("forms.fixErrors") };
  }
  if (err?.formError) return { fields: {}, formError: translateErrorCode(i18n, err.formError, namespaces) };
  if (err?.messageKey && i18n.exists(err.messageKey)) return { fields: {}, formError: i18n.t(err.messageKey) };
  return { fields: {}, formError: i18n.t("common.somethingWentWrong") };
}
