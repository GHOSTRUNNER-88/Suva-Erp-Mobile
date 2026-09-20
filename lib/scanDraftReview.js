import { useCallback, useEffect, useRef, useState } from "react";
import { readScanDraft, removeScanDraft } from "./scanDrafts";

/**
 * Read-side helpers for scan-to-entry drafts. lib/scanDrafts.js (owned by
 * the Scan Receipt screen) is the storage; this file only normalizes what
 * comes back and turns it into "what should the user double-check".
 *
 * Agreed draft shape:
 *   { scanDocumentId, documentType, payload: {...form fields...},
 *     unresolved: ["partyId", ...], lowConfidence: ["totalAmount", ...], createdAt }
 *
 * Read defensively — the previous shape stored the backend mapper's own
 * ScanDraftPayload verbatim: { documentType, data, unresolvedFields,
 * fieldConfidence: {field: 0-100} } (lowConfidence = confidence < 80, the
 * same threshold shared/scan-documents/mapper.ts uses).
 */
const LOW_CONFIDENCE_THRESHOLD = 80;

export function normalizeScanDraft(raw) {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw.payload ?? raw.data ?? raw;
  const unresolved = Array.isArray(raw.unresolved) ? raw.unresolved : Array.isArray(raw.unresolvedFields) ? raw.unresolvedFields : [];
  let lowConfidence = Array.isArray(raw.lowConfidence) ? raw.lowConfidence : null;
  if (!lowConfidence && raw.fieldConfidence && typeof raw.fieldConfidence === "object") {
    lowConfidence = Object.entries(raw.fieldConfidence)
      .filter(([, value]) => Number(value) < LOW_CONFIDENCE_THRESHOLD)
      .map(([key]) => key);
  }
  if (!lowConfidence && Array.isArray(raw.confidenceSummary?.lowConfidenceFields)) {
    lowConfidence = raw.confidenceSummary.lowConfidenceFields;
  }
  return {
    scanDocumentId: raw.scanDocumentId ?? null,
    documentType: raw.documentType ?? null,
    payload: payload && typeof payload === "object" ? { ...payload, notes: "" } : { notes: "" },
    unresolved: unresolved.map(String),
    lowConfidence: (lowConfidence ?? []).map(String),
    createdAt: raw.createdAt ?? null,
  };
}

/**
 * Prefill for QuickPartyModal when a scan read a party off the paper that
 * the backend could not match to an existing one (see the exact-match-only
 * rule in shared/scan-documents/service.ts's matchPartyByName). Returns null
 * unless there is actually a name to seed — the "+ Add Party" button then
 * opens an empty form exactly as it does outside the scan flow.
 *
 * `partyPan` / `partyPhone` come from the same Textract pass as the name, so
 * the user isn't re-keying registration details off a bill they just
 * photographed. Both are always strings from the mapper, possibly empty.
 */
export function scanPartyPrefill(draft) {
  const payload = draft?.payload;
  if (!payload || typeof payload !== "object") return null;
  const name = typeof payload.partyName === "string" ? payload.partyName.trim() : "";
  if (!name) return null;
  return {
    name,
    panNumber: typeof payload.partyPan === "string" ? payload.partyPan : "",
    phoneNumber: typeof payload.partyPhone === "string" ? payload.partyPhone : "",
  };
}

const DATE_FIELDS = new Set(["date", "invoiceDate", "billDate", "expenseDate", "paymentDate", "creditNoteDate", "debitNoteDate", "customsDeclarationDate", "orderDate", "chequeDate"]);
const KNOWN_FIELDS = new Set([
  "partyId",
  "warehouseId",
  "lines",
  "bankAccountId",
  "amount",
  "totalAmount",
  "billNumber",
  "expenseNumber",
  "categoryId",
  "notes",
  "taxableAmount",
  "nonTaxableAmount",
  "discValue",
  "vatPercent",
  "referenceNo",
  "description",
  "number",
  "text",
  "chequeNumber",
  "bankName",
  "orderNumber",
  "customsDeclarationNumber",
  "importCurrency",
  "exchangeRate",
]);

/** i18n key for a payload field name, or null when we have no label for it (caller shows the raw key then). */
export function scanFieldLabelKey(field) {
  if (DATE_FIELDS.has(field)) return "scanDraft.fields.date";
  if (KNOWN_FIELDS.has(field)) return `scanDraft.fields.${field}`;
  return null;
}

export function translateScanFields(t, fields) {
  const seen = new Set();
  const labels = [];
  for (const field of fields ?? []) {
    const key = scanFieldLabelKey(field);
    const label = key ? t(key) : String(field);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/**
 * Hook used by every create screen that can be opened from Scan Receipt.
 *
 *   const scan = useScanDraft(params.scanDocumentId, (payload) => { ...setState from payload... });
 *   scan.draft            → normalized draft or null (drives the banner)
 *   scan.fieldStatus("partyId")        → "unresolved" | "lowConfidence" | null
 *   scan.fieldProps(t, "amount", "totalAmount") → { warning } for FormField/PickerField/DateField
 *   scan.clearDraft()     → removes the stored draft + hides the banner (caller resets its form)
 *   scan.consumeDraft()   → removes the stored draft after a successful save
 *
 * `applyPayload` is captured in a ref so callers can pass an inline closure
 * without re-triggering the read on every render.
 */
export function useScanDraft(scanDocumentIdParam, applyPayload) {
  const scanId = Array.isArray(scanDocumentIdParam) ? scanDocumentIdParam[0] : scanDocumentIdParam;
  const applyRef = useRef(applyPayload);
  applyRef.current = applyPayload;
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!scanId) return undefined;
    let cancelled = false;
    readScanDraft(scanId)
      .then((raw) => {
        if (cancelled) return;
        const normalized = normalizeScanDraft(raw);
        if (!normalized) return;
        setDraft(normalized);
        try {
          applyRef.current?.(normalized.payload, normalized);
        } catch {
          // A malformed payload must never crash the form — the user can still type everything in.
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  const clearDraft = useCallback(async () => {
    if (scanId) await removeScanDraft(scanId).catch(() => {});
    setDraft(null);
  }, [scanId]);

  const consumeDraft = useCallback(async () => {
    if (scanId) await removeScanDraft(scanId).catch(() => {});
  }, [scanId]);

  const fieldStatus = useCallback(
    (...fields) => {
      if (!draft) return null;
      const names = fields.flat();
      if (names.some((name) => draft.unresolved.includes(name) || (DATE_FIELDS.has(name) && draft.unresolved.includes("date")))) return "unresolved";
      if (names.some((name) => draft.lowConfidence.includes(name) || (DATE_FIELDS.has(name) && draft.lowConfidence.includes("date")))) return "lowConfidence";
      return null;
    },
    [draft],
  );

  const fieldProps = useCallback(
    (t, ...fields) => {
      const status = fieldStatus(...fields);
      if (status === "unresolved") return { warning: t("scanDraft.fieldUnresolved") };
      if (status === "lowConfidence") return { warning: t("scanDraft.fieldLowConfidence") };
      return {};
    },
    [fieldStatus],
  );

  return { scanId: scanId ?? null, draft, clearDraft, consumeDraft, fieldStatus, fieldProps };
}
