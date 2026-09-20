import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "suva-scan-draft:";

/**
 * Builds the draft the Create* forms read back via readScanDraft(). This is
 * the one place the scan → form contract is written, so keep the shape in
 * sync with every Create*Screen's draft reader:
 *
 *   { scanDocumentId, documentType, payload, unresolved, lowConfidence, fieldSources, createdAt }
 *
 * `payload` is the backend's `suggestedPayload.data` verbatim (the create
 * form's own field names) — nothing is invented or "fixed up" on the client.
 * `unresolved` / `lowConfidence` / `fieldSources` let the form flag fields
 * the user still has to fill or double-check. A scan never becomes a final
 * document on its own — the user always saves from the normal form.
 */
export function buildScanDraft(result) {
  return buildScanDraftWithItems(result);
}

export function buildScanDraftWithItems(result, pendingItems = {}) {
  const suggested = result?.suggestedPayload ?? null;
  const sourcePayload = suggested?.data && typeof suggested.data === "object" ? suggested.data : {};
  const sourceLines = Array.isArray(sourcePayload.lines) ? sourcePayload.lines : [];
  const lines = sourceLines.map((line, index) => {
    const item = pendingItems[index];
    if (!item) return line;
    return {
      ...line,
      itemId: Number(item.itemId),
      unitId: Number(item.unitId),
      rate: item.rate != null ? Number(item.rate) : line.rate,
      rawDescription: item.name ?? line.rawDescription,
    };
  });
  const unresolved = Array.isArray(suggested?.unresolvedFields) ? suggested.unresolvedFields : [];
  const allLinesResolved = lines.length > 0 && lines.every((line) => Number(line?.itemId) > 0);
  return {
    scanDocumentId: result?.scanDocumentId ?? null,
    documentType: suggested?.documentType ?? result?.documentType ?? null,
    payload: { ...sourcePayload, lines, notes: "" },
    unresolved: allLinesResolved ? unresolved.filter((field) => field !== "lines") : unresolved,
    lowConfidence: Array.isArray(result?.confidenceSummary?.lowConfidenceFields) ? result.confidenceSummary.lowConfidenceFields : [],
    fieldSources: suggested?.fieldSources && typeof suggested.fieldSources === "object" ? suggested.fieldSources : {},
    createdAt: new Date().toISOString(),
  };
}

const PENDING_PREFIX = "suva-scan-pending-items:";

export async function savePendingScanItem(scanDocumentId, lineIndex, item) {
  if (!scanDocumentId || lineIndex == null || !item?.itemId || !item?.unitId) return;
  const key = `${PENDING_PREFIX}${scanDocumentId}`;
  const existing = await readPendingScanItems(scanDocumentId);
  existing[String(lineIndex)] = {
    itemId: Number(item.itemId),
    unitId: Number(item.unitId),
    name: item.name ?? "",
    rate: item.rate != null ? Number(item.rate) : null,
  };
  await AsyncStorage.setItem(key, JSON.stringify(existing));
}

export async function readPendingScanItems(scanDocumentId) {
  if (!scanDocumentId) return {};
  const raw = await AsyncStorage.getItem(`${PENDING_PREFIX}${scanDocumentId}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function removePendingScanItems(scanDocumentId) {
  if (scanDocumentId) await AsyncStorage.removeItem(`${PENDING_PREFIX}${scanDocumentId}`);
}

export async function saveScanDraft(scanDocumentId, draft) {
  await AsyncStorage.setItem(`${PREFIX}${scanDocumentId}`, JSON.stringify(draft));
}

export async function readScanDraft(scanDocumentId) {
  const raw = await AsyncStorage.getItem(`${PREFIX}${scanDocumentId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function removeScanDraft(scanDocumentId) {
  await AsyncStorage.removeItem(`${PREFIX}${scanDocumentId}`);
  await removePendingScanItems(scanDocumentId);
}
