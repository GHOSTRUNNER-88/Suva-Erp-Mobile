import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
  BackHandler,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";
import { ApiError, apiFetch, apiUpload } from "../lib/api";
import { buildScanDraftWithItems, readPendingScanItems, saveScanDraft } from "../lib/scanDrafts";
import { formatNpr } from "../lib/format";
import { isoAdToBs, formatBsDate } from "../lib/bs-ad";
import ScreenHeader from "../components/ui/ScreenHeader";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StickyActionBar from "../components/ui/StickyActionBar";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Scan → draft → normal create form. Four steps in one screen:
 *   1. document type   2. capture & reticle   3. extraction result & digital wallet verification   4. review in form.
 *
 * Supports regular accounting documents AND eSewa, Khalti, Fonepay, and Bank Transfer payment screenshots!
 */

const DOCUMENT_TYPES = [
  {
    value: "digital_payment",
    labelKey: "digitalPayment",
    icon: "smartphone",
    mciIcon: "cellphone-check",
    tone: "teal",
    route: "/payments/new",
    params: { type: "in" },
    isPopular: true,
  },
  { value: "purchase_bill", labelKey: "purchaseBill", icon: "shopping-cart", tone: "primary", route: "/purchases/new" },
  { value: "sales_invoice", labelKey: "salesInvoice", icon: "file-text", tone: "success", route: "/sales/new" },
  { value: "receipt", labelKey: "receipt", icon: "download", tone: "teal", route: "/payments/new", params: { type: "in" } },
  { value: "expense", labelKey: "expense", icon: "credit-card", tone: "danger", route: "/expenses/new" },
  { value: "payment_voucher", labelKey: "paymentVoucher", icon: "upload", tone: "orange", route: "/payments/new", params: { type: "out" } },
  { value: "credit_note", labelKey: "creditNote", icon: "corner-down-left", tone: "info", route: "/credit-notes/new", params: { type: "credit" } },
  { value: "debit_note", labelKey: "debitNote", icon: "corner-up-right", tone: "pink", route: "/debit-notes/new", params: { type: "debit" } },
  { value: "cheque", labelKey: "cheque", icon: "check-square", tone: "purple", route: "/cheques/new" },
];

const STEP_TONES = ["primary", "info", "success", "orange"];
const STEP_ICONS = ["file-text", "camera", "check-circle", "edit-3"];
const toneSurface = (tone) => colors[`${tone}Light`] ?? colors.primaryLight;

const STEPS = ["type", "capture", "result", "review"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;
const DATE_FIELDS = ["billDate", "invoiceDate", "expenseDate", "paymentDate", "creditNoteDate", "debitNoteDate", "chequeDate"];
const DOCUMENT_TYPE_DATE_FIELDS = {
  purchase_bill: "billDate",
  sales_invoice: "invoiceDate",
  expense: "expenseDate",
  receipt: "paymentDate",
  digital_payment: "paymentDate",
  payment_voucher: "paymentDate",
  credit_note: "creditNoteDate",
  debit_note: "debitNoteDate",
  cheque: "chequeDate",
};
const NUMBER_FIELDS = ["billNumber", "invoiceNumber", "expenseNumber", "referenceNo", "documentNumber", "chequeNumber"];
const TOTAL_FIELDS = ["extractedTotal", "totalAmount", "amount"];
const VAT_FIELDS = ["extractedVatAmount", "vatAmount"];
const SUBTOTAL_FIELDS = ["extractedSubtotal", "taxableAmount"];
const LOOKUP_FIELDS = ["warehouseId", "bankAccountId", "categoryId"];
const LEGACY_ERROR_CODES = { fileTypeInvalid: "scanUnsupportedFileType", fileTooLarge: "scanFileTooLarge", fileRequired: "scanUnsupportedFileType" };
const STATUS_ICON = { ok: "check-circle", low: "alert-triangle", unresolved: "x-circle" };
const STATUS_TONE = { ok: colors.success, low: colors.warning, unresolved: colors.danger };

/**
 * Intelligent on-device Nepal Digital Payment parser:
 * Recognizes eSewa, Khalti, Fonepay, ConnectIPS and Mobile Banking payment slips/receipts.
 */
export function parseNepalDigitalPayment(rawText = "") {
  if (!rawText) return null;
  const text = String(rawText);

  let channel = null;
  if (/esewa|e-sewa/i.test(text)) channel = "esewa";
  else if (/khalti/i.test(text)) channel = "khalti";
  else if (/fonepay/i.test(text)) channel = "fonepay";
  else if (
    /connectips|nabil|nic\s*asia|global\s*ime|prabhu|sanima|siddhartha|rastriya|himalayan|everest|kumari|prime|citizen|laxmi|sunrise/i.test(
      text
    )
  ) {
    channel = "bank_transfer";
  }

  if (!channel) return null;

  // Extract Txn / Reference ID
  let txnId = null;
  const txnMatch = text.match(
    /(?:txn|transaction|trace|retrieval\s*ref|ref(?:erence)?)\s*(?:id|code|no\.?|#)?\s*[:.-]?\s*([A-Za-z0-9-]{5,30})/i
  );
  if (txnMatch) txnId = txnMatch[1].trim();

  // Extract Amount
  let amount = null;
  const amountMatch = text.match(
    /(?:npr|rs\.?|amount|total\s*amount|paid)\s*[:.-]?\s*(?:npr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (amountMatch) {
    const parsed = Number(amountMatch[1].replace(/,/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) amount = parsed;
  }

  // Extract Remarks / Purpose
  let remarks = null;
  const remarksMatch = text.match(/(?:remarks|purpose|particulars|description)\s*[:.-]?\s*([^\n\r]{2,60})/i);
  if (remarksMatch) remarks = remarksMatch[1].trim();

  // Extract Party / Payer / Payee
  let partyName = null;
  const partyMatch = text.match(/(?:paid\s*to|transferred\s*to|merchant|recipient|received\s*from|sender)\s*[:.-]?\s*([^\n\r]{2,60})/i);
  if (partyMatch) partyName = partyMatch[1].trim();

  return {
    channel,
    txnId,
    amount,
    remarks,
    partyName,
  };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeAsset(asset) {
  const name = asset?.fileName ?? asset?.name ?? "";
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  let mime = asset?.mimeType ?? null;
  if (!mime) {
    if (extension === "png") mime = "image/png";
    else if (extension === "jpg" || extension === "jpeg") mime = "image/jpeg";
    else if (!extension && asset?.type === "image") mime = "image/jpeg";
  }
  const size = asset?.fileSize ?? asset?.size ?? null;
  return { name: name || `scan-${Date.now()}.${mime === "image/png" ? "png" : "jpg"}`, mime, size };
}

function validationCodeFor({ mime, size }) {
  if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) return "scanUnsupportedFileType";
  if (size != null && Number(size) > MAX_FILE_BYTES) return "scanFileTooLarge";
  return null;
}

const MIN_KB_PER_MEGAPIXEL = 60;

function isLikelyPoorQuality(asset) {
  const width = Number(asset?.width);
  const height = Number(asset?.height);
  const bytes = Number(asset?.size);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  if (!Number.isFinite(bytes) || bytes <= 0) return false;
  const megapixels = (width * height) / 1_000_000;
  if (megapixels <= 0) return false;
  const kbPerMegapixel = bytes / 1024 / megapixels;
  return kbPerMegapixel < MIN_KB_PER_MEGAPIXEL;
}

function isSafeCode(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function firstPresent(payload, fields) {
  return fields.find((field) => hasValue(payload[field]));
}

function moneyText(value) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? formatNpr(number) : String(value);
}

function confidenceLevel(average) {
  const value = Number(average);
  if (!Number.isFinite(value)) return null;
  if (value >= 85) return "high";
  if (value >= 60) return "medium";
  return "low";
}

function buildRows({ payload, unresolved, lowConfidence, fieldSources }, t, formatDate) {
  const rows = [];
  const covered = new Set([
    "partyId",
    "partyName",
    "lines",
    "extractedLineItems",
    "notes",
    ...DATE_FIELDS,
    ...NUMBER_FIELDS,
    ...TOTAL_FIELDS,
    ...VAT_FIELDS,
    ...SUBTOTAL_FIELDS,
    ...LOOKUP_FIELDS,
  ]);
  const statusFor = (fields, present) => {
    if (fields.some((field) => unresolved.includes(field))) return "unresolved";
    if (fields.some((field) => lowConfidence.includes(field))) return "low";
    return present ? "ok" : null;
  };
  const push = (key, label, value, fields) => {
    const present = hasValue(value);
    const status = statusFor(fields, present);
    if (!status && !present) return;
    rows.push({ key, label, value: present ? value : null, status: status ?? "ok", source: fieldSources[key] });
  };

  push("party", t("scan.fields.partyName"), payload.partyName, ["partyName", "partyId"]);
  const numField = firstPresent(payload, NUMBER_FIELDS);
  push("documentNumber", t("scan.fields.documentNumber"), numField ? payload[numField] : null, NUMBER_FIELDS);
  const dateField = firstPresent(payload, DATE_FIELDS);
  push("date", t("scan.fields.documentDate"), dateField ? formatDate(payload[dateField]) : null, DATE_FIELDS);

  const totalField = firstPresent(payload, TOTAL_FIELDS);
  push("total", t("scan.fields.total"), totalField ? moneyText(payload[totalField]) : null, TOTAL_FIELDS);
  const vatField = firstPresent(payload, VAT_FIELDS);
  push("vat", t("scan.fields.vat"), vatField ? moneyText(payload[vatField]) : null, VAT_FIELDS);
  const subtotalField = firstPresent(payload, SUBTOTAL_FIELDS);
  push("subtotal", t("scan.fields.subtotal"), subtotalField ? moneyText(payload[subtotalField]) : null, SUBTOTAL_FIELDS);

  LOOKUP_FIELDS.forEach((field) => {
    if (unresolved.includes(field)) rows.push({ key: field, label: t(`scan.fields.${field}`), value: null, status: "unresolved" });
  });
  unresolved.forEach((field) => {
    if (typeof field === "string" && !covered.has(field) && !rows.some((row) => row.key === field)) {
      rows.push({ key: field, label: t(`scan.fields.${field}`, { defaultValue: t("scan.fields.other") }), value: null, status: "unresolved" });
    }
  });

  const lineItems = Array.isArray(payload.extractedLineItems) ? payload.extractedLineItems.filter((line) => line && typeof line === "object") : [];
  const linesStatus = unresolved.includes("lines") ? "unresolved" : lowConfidence.includes("lines") || lowConfidence.includes("extractedLineItems") ? "low" : lineItems.length ? "ok" : null;
  return { rows, lineItems, linesStatus };
}

function StepIndicator({ step, t }) {
  const tone = STEP_TONES[step - 1];
  return (
    <View style={styles.stepper} accessibilityLabel={t("scan.stepOf", { current: step, total: STEPS.length })}>
      <View style={styles.stepperTopRow}>
        <View style={[styles.stepperBadge, { backgroundColor: tint(tone, 0.12), borderColor: tint(tone, 0.3) }]}>
          <Feather name={STEP_ICONS[step - 1]} size={13} color={colors[tone]} />
          <Text style={[styles.stepperBadgeText, { color: colors[tone] }]} numberOfLines={1}>
            {t(`scan.steps.${STEPS[step - 1]}`)}
          </Text>
        </View>
        <Text style={styles.stepperCount}>{t("scan.stepOf", { current: step, total: STEPS.length })}</Text>
      </View>
      <View style={styles.segmentRow}>
        {STEPS.map((key, index) => (
          <View
            key={key}
            style={[styles.segment, index < step && { backgroundColor: colors[STEP_TONES[index]] }]}
          />
        ))}
      </View>
    </View>
  );
}

function FieldRow({ row, t, onEdit }) {
  const tone = STATUS_TONE[row.status];
  const statusText = t(`scan.status.${row.status}`);
  return (
    <TouchableOpacity
      style={styles.fieldRow}
      onPress={hasValue(row.value) && onEdit ? onEdit : undefined}
      activeOpacity={hasValue(row.value) && onEdit ? 0.6 : 1}
      accessibilityRole={hasValue(row.value) && onEdit ? "button" : "text"}
    >
      <Feather name={STATUS_ICON[row.status]} size={18} color={tone} style={styles.fieldIcon} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{row.label}</Text>
        {hasValue(row.value) ? <Text style={styles.fieldValue}>{String(row.value)}</Text> : null}
        {row.status !== "ok" || !hasValue(row.value) ? <Text style={[styles.fieldStatus, { color: tone }]}>{statusText}</Text> : null}
        {hasValue(row.value) && onEdit ? (
          <Feather name="edit-3" size={12} color={colors.textMuted} style={{ marginTop: 2, alignSelf: "flex-start" }} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// Tab screen: the tab bar already clears the system nav inset, so the sticky
// action bar must not add insets.bottom on top of it.
const TAB_BAR_ACTIONS = { paddingBottom: 12 };

export default function ScanDocumentScreen() {
  const { t, i18n } = useTranslation();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const [step, setStep] = useState(1);
  const [organizationId, setOrganizationId] = useState(null);
  const [documentType, setDocumentType] = useState("digital_payment");
  const [asset, setAsset] = useState(null);
  const [qualityWarning, setQualityWarning] = useState(false);
  const [qualityAcknowledged, setQualityAcknowledged] = useState(false);
  const [qualityConfirmVisible, setQualityConfirmVisible] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [result, setResult] = useState(null);
  const [digitalPaymentInfo, setDigitalPaymentInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);
  const [showRawText, setShowRawText] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const [pendingItems, setPendingItems] = useState({});
  const [recentScans, setRecentScans] = useState([]);
  const [scansLoading, setScansLoading] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    apiFetch("/api/mobile/session")
      .then((data) => { if (mounted.current) setOrganizationId(data?.organization?.id ?? null); })
      .catch(() => { if (mounted.current) setCaptureError(t("scan.sessionUnavailable")); });
  }, [t]);

  const loadRecentScans = useCallback(() => {
    if (!organizationId) return;
    setScansLoading(true);
    apiFetch("/api/mobile/scan-documents")
      .then((data) => { if (mounted.current) setRecentScans(Array.isArray(data) ? data.slice(0, 10) : []); })
      .catch(() => { if (mounted.current) setRecentScans([]); })
      .finally(() => setScansLoading(false));
  }, [organizationId]);

  useEffect(() => {
    loadRecentScans();
  }, [loadRecentScans]);

  function openScan(scanDoc) {
    if (scanDoc?.status === "completed") {
      setResult(scanDoc);
      const paymentData = parseNepalDigitalPayment(scanDoc.rawText || "");
      setDigitalPaymentInfo(paymentData);
      setStep(3);
      setEditedFields({});
    }
  }

  useFocusEffect(useCallback(() => {
    if (!result?.scanDocumentId) return undefined;
    let active = true;
    readPendingScanItems(result.scanDocumentId).then((items) => {
      if (active) setPendingItems(items);
    }).catch(() => {});
    return () => { active = false; };
  }, [result?.scanDocumentId]));

  const selectedType = DOCUMENT_TYPES.find((type) => type.value === documentType) ?? DOCUMENT_TYPES[0];
  const typeLabel = t(`scan.${selectedType.labelKey}`);

  const formatDate = useCallback((value) => {
    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    try {
      const bs = isoAdToBs(text);
      return bs ? `${text} · ${formatBsDate(bs, i18n.language?.startsWith("ne") ? "ne" : "en")}` : text;
    } catch {
      return text;
    }
  }, [i18n.language]);

  function startEdit(key, value) {
    setEditingField(key);
    setEditValue(String(hasValue(value) ? value : ""));
  }

  function confirmEdit() {
    if (editingField && hasValue(editValue.trim())) {
      setEditedFields((prev) => ({ ...prev, [editingField]: editValue.trim() }));
    }
    setEditingField(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  function goBackStep() {
    if (busy || deleting) return;
    if (step === 1) { router.back(); return; }
    setStep(step - 1);
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 1) { goBackStep(); return true; }
      return false;
    });
    return () => subscription.remove();
  });

  // Polling for the processing status
  useEffect(() => {
    if (result?.status !== "processing" || !result?.scanDocumentId || pollTimedOut) return undefined;
    let attempts = 0;
    let cancelled = false;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const data = await apiFetch(`/api/mobile/scan-documents/${result.scanDocumentId}`);
        if (cancelled) return;
        if (data?.status && data.status !== "processing") {
          setResult(data);
          const paymentData = parseNepalDigitalPayment(data.rawText || "");
          setDigitalPaymentInfo(paymentData);
          return;
        }
      } catch {}
      if (!cancelled && attempts >= POLL_MAX_ATTEMPTS) setPollTimedOut(true);
    }, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [result?.status, result?.scanDocumentId, pollTimedOut, pollNonce]);

  function acceptAsset(picked) {
    setCaptureError(null);
    const info = describeAsset(picked);
    const code = validationCodeFor(info);
    if (code) { setAsset(null); setCaptureError(t(`scan.errors.${code}`)); return; }
    const merged = { ...picked, ...info };
    setAsset(merged);
    setQualityWarning(isLikelyPoorQuality(merged));
    setQualityAcknowledged(false);
  }

  async function chooseImage(fromCamera) {
    setCaptureError(null);
    try {
      const permission = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setCaptureError(t(fromCamera ? "scan.cameraPermissionDenied" : "scan.libraryPermissionDenied")); return; }
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true, mediaTypes: ["images"] });
      if (!picked.canceled && picked.assets?.[0]) acceptAsset(picked.assets[0]);
    } catch {
      setCaptureError(t("scan.errors.generic"));
    }
  }

  async function browseFiles() {
    setCaptureError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ALLOWED_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
      if (!picked.canceled && picked.assets?.[0]) acceptAsset(picked.assets[0]);
    } catch {
      setCaptureError(t("scan.errors.generic"));
    }
  }

  function errorTextFor(err) {
    const fileCode = err?.fieldErrors?.file?.[0];
    const generic = t("scan.errors.generic");
    if (fileCode) return t(`scan.errors.${LEGACY_ERROR_CODES[fileCode] ?? fileCode}`, { defaultValue: generic });
    if ((err?.code === "not_authenticated" || err?.code === "unauthorized") && err?.messageKey) return t(err.messageKey, { defaultValue: generic });
    if (!(err instanceof ApiError)) return t("scan.errors.network");
    return generic;
  }

  async function upload() {
    if (!asset || busy) return;
    let orgId = organizationId;
    if (!orgId) {
      try {
        const sessionData = await apiFetch("/api/mobile/session");
        orgId = sessionData?.organization?.id ?? null;
        if (orgId && mounted.current) setOrganizationId(orgId);
      } catch {}
    }
    if (!orgId) {
      setCaptureError(t("scan.sessionUnavailable", { defaultValue: "Organization session unavailable. Please try again." }));
      return;
    }
    const code = validationCodeFor(asset);
    if (code) { setCaptureError(t(`scan.errors.${code}`)); return; }
    setCaptureError(null); setBusy(true); setPollTimedOut(false); setShowRawText(false);

    // Map digital_payment to receipt backend handler
    const backendDocType = documentType === "digital_payment" ? "receipt" : documentType;

    try {
      const data = await apiUpload("/api/mobile/scan-documents", {
        uri: asset.uri,
        mimeType: asset.mime,
        fields: { organizationId: String(orgId), documentType: backendDocType },
      });
      if (!mounted.current) return;
      setResult(data ?? { status: "failed", errorMessage: "scanProcessingFailed" });

      // Run digital payment screenshot parser
      const parsedPayment = parseNepalDigitalPayment(data?.rawText || "");
      setDigitalPaymentInfo(parsedPayment);

      setStep(3);
    } catch (err) {
      if (mounted.current) setCaptureError(errorTextFor(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function attemptUpload() {
    if (!asset || busy) return;
    if (qualityWarning && !qualityAcknowledged) {
      setQualityConfirmVisible(true);
      return;
    }
    upload();
  }

  async function deleteScanOnServer(id) {
    if (!id) return;
    try { await apiFetch(`/api/mobile/scan-documents/${id}`, { method: "DELETE" }); } catch {}
  }

  async function rescan() {
    if (deleting) return;
    const id = result?.scanDocumentId;
    setResult(null); setDigitalPaymentInfo(null); setAsset(null); setQualityWarning(false); setQualityAcknowledged(false); setCaptureError(null); setPollTimedOut(false); setStep(2);
    await deleteScanOnServer(id);
  }

  async function confirmDelete() {
    setConfirmDeleteVisible(false);
    setDeleting(true);
    await deleteScanOnServer(result?.scanDocumentId);
    if (!mounted.current) return;
    setDeleting(false); setResult(null); setDigitalPaymentInfo(null); setAsset(null); setQualityWarning(false); setQualityAcknowledged(false); setCaptureError(null); setPollTimedOut(false); setStep(1);
  }

  async function reviewInForm() {
    if (!result?.scanDocumentId || result.status !== "completed" || handingOff) return;
    setHandingOff(true);
    try {
      const draft = buildScanDraftWithItems(result, pendingItems);
      const mergedPayload = { ...draft.payload };

      if (editedFields.documentNumber) {
        const numField = NUMBER_FIELDS.find((field) => hasValue(mergedPayload[field]));
        if (numField) mergedPayload[numField] = editedFields.documentNumber;
        else {
          const typeField = ["billNumber", "invoiceNumber", "expenseNumber"][0];
          mergedPayload[typeField] = editedFields.documentNumber;
        }
      }
      if (editedFields.date) {
        const dateField = DATE_FIELDS.find((field) => hasValue(mergedPayload[field]));
        if (dateField) mergedPayload[dateField] = editedFields.date;
        else mergedPayload[DOCUMENT_TYPE_DATE_FIELDS[documentType] ?? "date"] = editedFields.date;
      }
      if (editedFields.total) {
        const totalField = TOTAL_FIELDS.find((field) => hasValue(mergedPayload[field]));
        if (totalField) mergedPayload[totalField] = Number(editedFields.total);
      }
      if (editedFields.vat && editedFields.vat !== "") mergedPayload[editedFields.vat.startsWith("vat") ? "vatAmount" : "vatPercent"] = Number(editedFields.vat);
      if (editedFields.subtotal && editedFields.subtotal !== "") mergedPayload["taxableAmount"] = Number(editedFields.subtotal);
      if (editedFields.party && editedFields.party !== "") mergedPayload["partyName"] = editedFields.party;

      // Digital payment enhancements
      if (digitalPaymentInfo) {
        if (digitalPaymentInfo.amount && !mergedPayload.amount) {
          mergedPayload.amount = digitalPaymentInfo.amount;
        }
        if (digitalPaymentInfo.partyName && !mergedPayload.partyName) {
          mergedPayload.partyName = digitalPaymentInfo.partyName;
        }
        if (digitalPaymentInfo.txnId) {
          const channelName = digitalPaymentInfo.channel.toUpperCase();
          const pNote = `${channelName} Ref: ${digitalPaymentInfo.txnId}${digitalPaymentInfo.remarks ? ` | ${digitalPaymentInfo.remarks}` : ""}`;
          mergedPayload.notes = mergedPayload.notes ? `${mergedPayload.notes}\n${pNote}` : pNote;
        }
      }

      const mergedDraft = { ...draft, payload: mergedPayload };
      await saveScanDraft(result.scanDocumentId, mergedDraft);
      setEditedFields({});
      router.push({ pathname: selectedType.route, params: { scanDocumentId: String(result.scanDocumentId), ...(selectedType.params ?? {}) } });
    } catch {
      setCaptureError(t("scan.errors.generic"));
    } finally {
      if (mounted.current) setHandingOff(false);
    }
  }

  async function sendDraftToPc() {
    if (!result?.scanDocumentId || result.status !== "completed" || handingOff) return;
    setHandingOff(true);
    try {
      await saveScanDraft(result.scanDocumentId, buildScanDraftWithItems(result, pendingItems));
      setCaptureError(t("dashboard.draftSentToPc", "Draft synced to desktop PC."));
    } catch {
      setCaptureError(t("scan.errors.generic"));
    } finally {
      if (mounted.current) setHandingOff(false);
    }
  }

  function addUnknownItem(line, index) {
    router.push({
      pathname: "/items/new",
      params: {
        returnToScan: "1",
        scanDocumentId: String(result.scanDocumentId),
        scanLineIndex: String(index),
        itemName: hasValue(line.description) ? String(line.description) : "",
        itemRate: hasValue(line.rate) ? String(line.rate) : "0",
      },
    });
  }

  function renderTypeStep() {
    return (
      <View>
        <View style={styles.scanHero}>
          <View style={styles.scanHeroIcon}>
            <MaterialCommunityIcons name="line-scan" size={26} color="#FBBF24" />
          </View>
          <View style={styles.scanHeroCopy}>
            <Text style={styles.scanHeroEyebrow}>{t("scan.heroEyebrow")}</Text>
            <Text style={styles.scanHeroTitle}>{t("scan.heroTitle")}</Text>
            <Text style={styles.scanHeroText}>
              {isNepali
                ? "इ-सेवा, खल्ती, फोनपे वा बिलको फोटो खिच्नुहोस्। विवरणहरू स्वतः फारममा भरिनेछन्।"
                : "Scan bills, receipts, or payment screenshots (eSewa, Khalti, Bank). Details pre-fill directly."}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderIcon}>
            <Feather name="file-text" size={15} color={colors.iconMuted} />
          </View>
          <Text style={styles.sectionTitle}>{t("scan.chooseTypeTitle")}</Text>
        </View>
        <Text style={styles.helper}>{t("scan.chooseTypeHelper")}</Text>

        <View style={styles.typeGrid}>
          {DOCUMENT_TYPES.map((type) => {
            const active = type.value === documentType;
            return (
              <Pressable
                key={type.value}
                onPress={() => setDocumentType(type.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.typeCard,
                  active && { borderColor: colors[type.tone], backgroundColor: toneSurface(type.tone) },
                  type.isPopular && styles.typeCardPopular,
                  pressed && styles.pressed,
                ]}
              >
                {type.isPopular ? (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>🇳🇵 eSewa / Khalti</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.typeIcon,
                    active && { backgroundColor: colors[type.tone], borderColor: colors[type.tone] },
                  ]}
                >
                  {type.mciIcon ? (
                    <MaterialCommunityIcons name={type.mciIcon} size={20} color={active ? "#fff" : colors[type.tone]} />
                  ) : (
                    <Feather name={type.icon} size={20} color={active ? "#fff" : colors.iconMuted} />
                  )}
                </View>
                <Text style={[styles.typeLabel, active && { color: colors[type.tone] }]}>
                  {t(`scan.${type.labelKey}`)}
                </Text>
                <Text style={styles.typeHint} numberOfLines={2}>
                  {t(`scan.hints.${type.labelKey}`)}
                </Text>
                {active ? (
                  <Feather name="check-circle" size={16} color={colors[type.tone]} style={styles.typeCheck} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {recentScans.length > 0 ? (
          <View style={styles.recentScansSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderIcon}>
                <Feather name="clock" size={15} color={colors.iconMuted} />
              </View>
              <Text style={styles.sectionTitle}>{t("scan.recentScans", { defaultValue: "Recent Scans" })}</Text>
            </View>
            {recentScans.map((scanDoc) => {
              const docType = DOCUMENT_TYPES.find((type) => type.value === scanDoc.documentType);
              const icon = docType?.icon ?? "file-text";
              const tone = docType?.tone ?? "primary";
              const statusColor =
                scanDoc.status === "completed" ? colors.success : scanDoc.status === "failed" ? colors.danger : colors.warning;
              return (
                <TouchableOpacity
                  key={scanDoc.scanDocumentId}
                  style={styles.recentScanRow}
                  activeOpacity={0.75}
                  onPress={() => openScan(scanDoc)}
                  accessibilityRole="button"
                  accessibilityLabel={`${scanDoc.documentType} - ${scanDoc.status}`}
                >
                  <View style={[styles.recentScanIcon, { backgroundColor: toneSurface(tone) }]}>
                    <Feather name={icon} size={16} color={colors[tone]} />
                  </View>
                  <View style={styles.recentScanBody}>
                    <Text style={styles.recentScanType}>
                      {docType ? t(`scan.${docType.labelKey}`) : scanDoc.documentType}
                    </Text>
                    <Text style={styles.recentScanDate}>
                      {scanDoc.createdAt
                        ? new Date(scanDoc.createdAt).toLocaleDateString(i18n.language?.startsWith("ne") ? "ne-NP" : "en-US")
                        : "—"}
                    </Text>
                  </View>
                  <View style={[styles.recentScanStatusDot, { backgroundColor: statusColor }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : scansLoading ? null : null}
      </View>
    );
  }

  function renderAccuracyNotice() {
    return (
      <View style={styles.noticeBox}>
        <View style={styles.noticeIcon}>
          <Feather name="alert-circle" size={16} color={colors.warning} />
        </View>
        <View style={styles.noticeBody}>
          <Text style={styles.noticeTitle}>{t("scan.accuracyNoticeTitle")}</Text>
          <Text style={styles.noticeText}>{t("scan.accuracyNotice")}</Text>
        </View>
      </View>
    );
  }

  function renderCaptureStep() {
    const assetMeta = asset
      ? [asset.mime === "image/png" ? "PNG" : "JPEG", formatBytes(asset.size)].filter(Boolean).join("  ·  ")
      : null;
    const rawRatio = asset?.width && asset?.height ? asset.width / asset.height : 3 / 4;
    const previewRatio = Math.min(Math.max(rawRatio, 0.6), 1.6);

    return (
      <View>
        {/* Futuristic camera reticle box */}
        <View style={styles.viewfinderBox}>
          <View style={[styles.reticleCorner, styles.reticleTL]} />
          <View style={[styles.reticleCorner, styles.reticleTR]} />
          <View style={[styles.reticleCorner, styles.reticleBL]} />
          <View style={[styles.reticleCorner, styles.reticleBR]} />
          <View style={styles.viewfinderContent}>
            <MaterialCommunityIcons name="line-scan" size={42} color={colors.primary} />
            <Text style={styles.viewfinderTitle}>
              {documentType === "digital_payment"
                ? isNepali
                  ? "इ-सेवा, खल्ती, फोनपे वा बैंक स्क्रिनसट"
                  : "eSewa, Khalti, Fonepay or Bank Slip"
                : isNepali
                ? "बिल वा रसिद फ्रेमभित्र राख्नुहोस्"
                : "Align Document Inside Frame"}
            </Text>
            <Text style={styles.viewfinderSub}>{t("scan.viewfinderHint")}</Text>
          </View>
        </View>

        {renderAccuracyNotice()}

        {captureError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{captureError}</Text>
          </View>
        ) : null}

        {asset ? (
          <View style={[styles.card, styles.previewCard]}>
            <View style={styles.previewHeader}>
              <View style={styles.previewChip}>
                <Feather name="image" size={14} color={colors.iconMuted} />
              </View>
              <View style={styles.previewMeta}>
                <Text style={styles.previewTitle} numberOfLines={1}>{t("scan.preview")}</Text>
                {assetMeta ? <Text style={styles.previewSub} numberOfLines={1}>{assetMeta}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => setAsset(null)} style={styles.previewClearBtn}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ position: "relative" }}>
              <Image source={{ uri: asset.uri }} style={[styles.preview, { aspectRatio: previewRatio }]} resizeMode="contain" />
              {/* Laser scanning bar effect */}
              {busy ? <View style={styles.scanningLaser} /> : null}
            </View>

            {busy ? (
              <View style={styles.processing}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.processingTitle}>{t("scan.readingDocument")}</Text>
                <Text style={styles.processingBody}>{t("scan.readingHelper")}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {asset && qualityWarning ? (
          <View style={styles.qualityWarningBox}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <View style={styles.qualityWarningBody}>
              <Text style={styles.qualityWarningTitle}>{t("scan.qualityWarningTitle")}</Text>
              <Text style={styles.qualityWarningText}>{t("scan.qualityWarningText")}</Text>
            </View>
          </View>
        ) : null}

        {!asset ? (
          <View style={styles.captureActions}>
            <Pressable
              onPress={() => chooseImage(true)}
              style={({ pressed }) => [styles.captureCard, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={styles.captureIcon}>
                <Feather name="camera" size={24} color="#fff" />
              </View>
              <Text style={styles.captureLabel}>{t("scan.captureButton")}</Text>
            </Pressable>

            <Pressable
              onPress={() => chooseImage(false)}
              style={({ pressed }) => [styles.captureCard, styles.captureCardSecondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.captureIcon, styles.captureIconSecondary]}>
                <MaterialCommunityIcons name="image-multiple-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.captureLabel, styles.captureLabelSecondary]}>
                {isNepali ? "स्क्रिनसट / ग्यालरी" : "Gallery / Screenshot"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!asset ? (
          <TouchableOpacity style={styles.browseFilesButton} onPress={browseFiles} activeOpacity={0.75}>
            <Feather name="folder" size={16} color={colors.textMuted} />
            <Text style={styles.browseFilesText}>{t("scan.browseFiles")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  function renderFailedCard() {
    const code = isSafeCode(result?.errorMessage) ? result.errorMessage : "scanProcessingFailed";
    return (
      <View style={[styles.card, styles.stateCard]}>
        <View style={[styles.stateIcon, { backgroundColor: tint("danger", 0.12), borderColor: tint("danger", 0.3) }]}>
          <Feather name="alert-triangle" size={22} color={colors.danger} />
        </View>
        <Text style={styles.stateTitle}>{t("scan.failedTitle")}</Text>
        <Text style={styles.stateBody}>{t(`scan.errors.${code}`, { defaultValue: t("scan.errors.generic") })}</Text>
        {captureError ? <Text style={[styles.stateBody, { color: colors.danger }]}>{captureError}</Text> : null}
      </View>
    );
  }

  function renderProcessingCard() {
    return (
      <View style={[styles.card, styles.stateCard]}>
        {pollTimedOut ? (
          <View style={[styles.stateIcon, { backgroundColor: tint("warning", 0.12), borderColor: tint("warning", 0.3) }]}>
            <Feather name="clock" size={22} color={colors.warning} />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />
        )}
        <Text style={styles.stateTitle}>{t("scan.processingTitle")}</Text>
        <Text style={styles.stateBody}>{pollTimedOut ? t("scan.processingTimeout") : t("scan.processingHelper")}</Text>
      </View>
    );
  }

  function renderResultStep() {
    if (!result) return null;
    if (result.status === "failed") return renderFailedCard();
    if (result.status === "processing") return renderProcessingCard();

    const suggested = result.suggestedPayload ?? {};
    const rawPayload = suggested.data && typeof suggested.data === "object" ? suggested.data : {};
    const payload = { ...rawPayload, ...editedFields };
    const unresolved = Array.isArray(suggested.unresolvedFields) ? suggested.unresolvedFields : [];
    const lowConfidence = Array.isArray(result.confidenceSummary?.lowConfidenceFields) ? result.confidenceSummary.lowConfidenceFields : [];
    const fieldSources = suggested.fieldSources && typeof suggested.fieldSources === "object" ? suggested.fieldSources : {};
    const { rows, lineItems, linesStatus } = buildRows({ payload, unresolved, lowConfidence, fieldSources }, t, formatDate);
    const level = confidenceLevel(result.confidenceSummary?.average);
    const levelTone = level === "high" ? colors.success : level === "medium" ? colors.warning : level === "low" ? colors.danger : colors.textMuted;
    const nothingExtracted = rows.length === 0 && lineItems.length === 0 && !linesStatus && !digitalPaymentInfo;

    return (
      <View>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderIcon}>
            <Feather name="check-circle" size={15} color={colors.iconMuted} />
          </View>
          <Text style={styles.sectionTitle}>{t("scan.resultTitle")}</Text>
        </View>
        <Text style={styles.helper}>{t("scan.reviewHelper")}</Text>

        <View style={[styles.confidencePill, { borderColor: `${levelTone}55`, backgroundColor: `${levelTone}14` }]}>
          <Feather name={level === "high" ? "shield" : "info"} size={14} color={levelTone} />
          <Text style={[styles.confidenceText, { color: levelTone }]}>
            {t(`scan.confidence${level ? level[0].toUpperCase() + level.slice(1) : "Unknown"}`)}
          </Text>
        </View>

        {/* Digital Payment Verified Card (eSewa / Khalti / Bank) */}
        {digitalPaymentInfo ? (
          <View style={styles.digitalPaymentCard}>
            <View style={styles.digitalPaymentHeader}>
              <View style={styles.digitalPaymentBadgeIcon}>
                <MaterialCommunityIcons name="check-decagram" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.digitalPaymentTitle}>
                  {digitalPaymentInfo.channel === "esewa"
                    ? t("scan.esewaDetected", "eSewa Payment Verified")
                    : digitalPaymentInfo.channel === "khalti"
                    ? t("scan.khaltiDetected", "Khalti Payment Verified")
                    : digitalPaymentInfo.channel === "fonepay"
                    ? t("scan.fonepayDetected", "Fonepay Transfer Verified")
                    : t("scan.bankTransferDetected", "Bank Transfer Verified")}
                </Text>
                <Text style={styles.digitalPaymentSub}>
                  {digitalPaymentInfo.txnId ? `Txn ID: ${digitalPaymentInfo.txnId}` : "Digital Payment Screenshot"}
                </Text>
              </View>
            </View>

            {digitalPaymentInfo.amount ? (
              <View style={styles.digitalPaymentAmountRow}>
                <Text style={styles.digitalPaymentAmountLabel}>{t("scan.fields.total", "Amount")}</Text>
                <Text style={styles.digitalPaymentAmountVal}>{formatNpr(digitalPaymentInfo.amount)}</Text>
              </View>
            ) : null}

            {digitalPaymentInfo.remarks ? (
              <View style={styles.digitalPaymentRemarksRow}>
                <Text style={styles.digitalPaymentRemarksLabel}>{t("common.description", "Remarks")}:</Text>
                <Text style={styles.digitalPaymentRemarksVal}>{digitalPaymentInfo.remarks}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {renderAccuracyNotice()}

        <View style={styles.card}>
          {nothingExtracted ? (
            <Text style={styles.stateBody}>{t("scan.noFieldsExtracted")}</Text>
          ) : (
            rows.map((row) => {
              const isEditing = editingField === row.key;
              return (
                <View key={row.key}>
                  <FieldRow
                    row={{ ...row, value: editedFields[row.key] ?? row.value }}
                    t={t}
                    onEdit={() => startEdit(row.key, editedFields[row.key] ?? row.value)}
                  />
                  {isEditing ? (
                    <View style={styles.editFieldRow}>
                      <TextInput
                        style={styles.editFieldInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        autoFocus
                        placeholder={row.label}
                      />
                      <TouchableOpacity style={styles.editSaveBtn} onPress={confirmEdit}>
                        <Feather name="check" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit}>
                        <Feather name="x" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {lineItems.length > 0 ? (
            <View style={styles.linesSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t("scan.lineItems")}</Text>
              </View>
              {lineItems.map((line, idx) => {
                const pending = pendingItems[idx];
                return (
                  <View key={idx} style={styles.lineRow}>
                    <View style={styles.lineBody}>
                      <Text style={styles.lineDescription} numberOfLines={1}>
                        {pending?.name ?? line.description ?? "Item"}
                      </Text>
                      <Text style={styles.lineMeta}>
                        {line.quantity ? `${line.quantity} × ` : ""}
                        {line.rate ? formatNpr(line.rate) : ""}
                      </Text>
                    </View>
                    <View style={styles.lineActions}>
                      <Text style={styles.lineAmount}>{line.amount ? formatNpr(line.amount) : ""}</Text>
                      {!line.matched && !pending ? (
                        <TouchableOpacity
                          style={styles.addItemButton}
                          onPress={() => addUnknownItem(line, idx)}
                          activeOpacity={0.75}
                        >
                          <Feather name="plus" size={12} color={colors.primary} />
                          <Text style={styles.addItemText}>{t("scan.addItem")}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Sync to Desktop PC button */}
        <TouchableOpacity style={styles.syncToPcCard} onPress={sendDraftToPc} activeOpacity={0.8}>
          <MaterialCommunityIcons name="laptop" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.syncToPcTitle}>{t("dashboard.syncToDesktop", "Sync Draft to PC")}</Text>
            <Text style={styles.syncToPcSub}>
              {isNepali ? "कम्प्युटरको ड्राफ्टमा स्वतः पठाउनुहोस्" : "Open and post from Desktop Web ERP"}
            </Text>
          </View>
          <Feather name="cloud-snow" size={16} color={colors.iconMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("scan.title")}
        onBack={goBackStep}
        rightAction={
          result ? (
            <TouchableOpacity onPress={() => setConfirmDeleteVisible(true)} style={{ padding: 6 }}>
              <Feather name="trash-2" size={18} color={colors.danger} />
            </TouchableOpacity>
          ) : null
        }
      />

      <StepIndicator step={step} t={t} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && renderTypeStep()}
        {step === 2 && renderCaptureStep()}
        {step === 3 && renderResultStep()}
      </ScrollView>

      {/* Sticky Bottom Actions */}
      {step === 1 ? (
        <StickyActionBar style={TAB_BAR_ACTIONS}>
          <Button
            label={t("scan.continue")}
            variant="primary"
            onPress={() => setStep(2)}
            style={styles.actionButton}
          />
        </StickyActionBar>
      ) : step === 2 ? (
        <StickyActionBar style={TAB_BAR_ACTIONS}>
          <Button
            label={t("scan.scanButton")}
            variant="primary"
            disabled={!asset || busy}
            loading={busy}
            onPress={attemptUpload}
            style={styles.actionButton}
          />
        </StickyActionBar>
      ) : step === 3 ? (
        <StickyActionBar style={TAB_BAR_ACTIONS}>
          <Button
            label={t("common.retry", "Rescan")}
            variant="outline"
            onPress={rescan}
            style={{ flex: 1 }}
          />
          <Button
            label={t("dashboard.continueInForm", "Review in Form")}
            variant="primary"
            loading={handingOff}
            onPress={reviewInForm}
            style={{ flex: 2 }}
          />
        </StickyActionBar>
      ) : null}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title={t("scan.deleteScanTitle", { defaultValue: "Discard Scan?" })}
        body={t("scan.deleteScanBody", { defaultValue: "Are you sure you want to discard this scan and start over?" })}
        confirmLabel={t("common.confirm", { defaultValue: "Discard" })}
        cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
        danger
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  stepper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepperTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  stepperBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  stepperBadgeText: { fontFamily: fonts.semiBold, fontSize: 11 },
  stepperCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  segmentRow: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },

  scrollContent: { padding: 16, paddingBottom: 110 },
  scanHero: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#1E1B4B",
    marginBottom: 16,
  },
  scanHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanHeroCopy: { flex: 1 },
  scanHeroEyebrow: { fontFamily: fonts.semiBold, fontSize: 10, color: "#A5B4FC", letterSpacing: 0.8 },
  scanHeroTitle: { fontFamily: fonts.bold, fontSize: 16, color: "#fff", marginTop: 2 },
  scanHeroText: { fontFamily: fonts.medium, fontSize: 11, color: "#C7D2FE", marginTop: 4, lineHeight: 16 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionHeaderIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  helper: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 12 },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: {
    width: "48%",
    flexGrow: 1,
    minHeight: 126,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  typeCardPopular: { borderColor: "#A7F3D0" },
  popularBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
  },
  popularBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: "#059669" },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.bodyBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  typeLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginBottom: 2 },
  typeHint: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, lineHeight: 14 },
  typeCheck: { position: "absolute", top: 10, right: 10 },

  // Camera Viewfinder Box
  viewfinderBox: {
    position: "relative",
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    marginBottom: 16,
    overflow: "hidden",
  },
  reticleCorner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: colors.primary,
  },
  reticleTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  reticleTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  reticleBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  reticleBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  viewfinderContent: { alignItems: "center", gap: 6 },
  viewfinderTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, textAlign: "center", marginTop: 4 },
  viewfinderSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textAlign: "center" },

  captureActions: { flexDirection: "row", gap: 10, marginBottom: 8 },
  captureCard: {
    flex: 1,
    minHeight: 120,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  captureCardSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  captureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureIconSecondary: { backgroundColor: colors.primaryLight },
  captureLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: "#fff", textAlign: "center" },
  captureLabelSecondary: { color: colors.text },
  browseFilesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  browseFilesText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted },

  previewCard: { padding: 0, overflow: "hidden", marginBottom: 14 },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  previewChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
  },
  previewMeta: { flex: 1 },
  previewTitle: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  previewSub: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted },
  previewClearBtn: { padding: 4 },
  preview: { width: "100%", backgroundColor: colors.bodyBg },
  scanningLaser: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  processing: { alignItems: "center", padding: 20, gap: 6 },
  processingTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  processingBody: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },

  noticeBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.warningLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tint("warning", 0.3),
  },
  noticeIcon: { marginTop: 1 },
  noticeBody: { flex: 1 },
  noticeTitle: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  noticeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  errorBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: tint("danger", 0.08),
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tint("danger", 0.3),
  },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.danger },
  qualityWarningBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.warningLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tint("warning", 0.3),
  },
  qualityWarningBody: { flex: 1 },
  qualityWarningTitle: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  qualityWarningText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  confidencePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 12,
  },
  confidenceText: { fontFamily: fonts.semiBold, fontSize: 11 },

  // Digital Payment Verified Card
  digitalPaymentCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  digitalPaymentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  digitalPaymentBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  digitalPaymentTitle: { fontFamily: fonts.bold, fontSize: 13, color: "#065F46" },
  digitalPaymentSub: { fontFamily: fonts.medium, fontSize: 11, color: "#047857", marginTop: 1 },
  digitalPaymentAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#A7F3D0",
  },
  digitalPaymentAmountLabel: { fontFamily: fonts.medium, fontSize: 12, color: "#047857" },
  digitalPaymentAmountVal: { fontFamily: fonts.bold, fontSize: 18, color: "#065F46" },
  digitalPaymentRemarksRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  digitalPaymentRemarksLabel: { fontFamily: fonts.semiBold, fontSize: 11, color: "#047857" },
  digitalPaymentRemarksVal: { fontFamily: fonts.medium, fontSize: 11, color: "#065F46", flex: 1 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 10,
  },
  fieldIcon: { marginTop: 1 },
  fieldBody: { flex: 1 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  fieldValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginTop: 1 },
  fieldStatus: { fontFamily: fonts.medium, fontSize: 10, marginTop: 2 },
  editFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 28,
    paddingVertical: 8,
  },
  editFieldInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editSaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  linesSection: { marginTop: 12 },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  lineBody: { flex: 1 },
  lineDescription: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  lineMeta: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  lineActions: { alignItems: "flex-end", gap: 4 },
  lineAmount: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  },
  addItemText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.primary },

  syncToPcCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  syncToPcTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  syncToPcSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 1 },

  stateCard: { alignItems: "center", paddingVertical: 28, borderRadius: 16 },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  stateTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: 4 },
  stateBody: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textAlign: "center" },

  recentScansSection: { marginTop: 16 },
  recentScanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  recentScanIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  recentScanBody: { flex: 1 },
  recentScanType: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  recentScanDate: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted },
  recentScanStatusDot: { width: 8, height: 8, borderRadius: 4 },
  actionButton: { flex: 1 },
});
