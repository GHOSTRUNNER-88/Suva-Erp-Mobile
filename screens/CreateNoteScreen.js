import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { useScanDraft, scanPartyPrefill } from "../lib/scanDraftReview";
import QuickPartyModal from "../components/QuickPartyModal";
import { estimateDocumentTotals, isNonNegativeNumber, isPercent, isIsoDate, toNumber, round2 } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import { bankAccountLabel } from "../lib/labels";
import { formatNpr } from "../lib/format";
import { todayIsoAd } from "../lib/bs-ad";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import SwitchRow from "../components/ui/SwitchRow";
import DiscountField from "../components/ui/DiscountField";
import MoneySummary from "../components/ui/MoneySummary";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";
import LineItemsEditor, { normalizeLine } from "../components/LineItemsEditor";
import ScanDraftBanner from "../components/ScanDraftBanner";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * One screen for Credit Notes (customer returns) and Debit Notes (supplier
 * returns), keyed by the `type` route param ("credit" | "debit") — the same
 * shared DocumentForm desktop uses for both. Fields mirror
 * creditNoteInputSchema / debitNoteInputSchema: date → party → warehouse →
 * referenceNo → lines → discount/VAT + totals → refund settlement
 * (isRefunded / refundAmount / bankAccountId) → notes.
 *
 * Credit notes always post creditNoteType "sales_return" (desktop's form has
 * no control for price_protection either), which is exactly the case where
 * the service requires a warehouse — so the warehouse is required on both
 * note types here. billingName/billingAddress (credit) and supplierName/
 * supplierAddress (debit) are optional and stay in desktop's details modal.
 *
 * Totals are DISPLAY-ONLY estimates; the service recomputes (../AGENTS.md §5).
 */
export default function CreateNoteScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const isEdit = Boolean(params.id);
  const noteType = params.type === "debit" ? "debit" : "credit";
  const isCredit = noteType === "credit";
  const errorNamespaces = ["creditDebit", "sale"];

  const [refData, setRefData] = useState({ parties: [], items: [], warehouses: [], bankAccounts: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [date, setDate] = useState(todayIsoAd());
  const [partyId, setPartyId] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [referenceNo, setReferenceNo] = useState("");
  const [lines, setLines] = useState([]);
  const [discType, setDiscType] = useState("percent");
  const [discValue, setDiscValue] = useState("0");
  const [isVatApplicable, setIsVatApplicable] = useState(false);
  const [vatPercent, setVatPercent] = useState("13");
  const [isRefunded, setIsRefunded] = useState(false);
  const [refundAmount, setRefundAmount] = useState("0");
  const [bankAccountId, setBankAccountId] = useState(null);
  const [notes, setNotes] = useState("");

  const [quickPartyOpen, setQuickPartyOpen] = useState(false);

  function handlePartyCreated(newParty) {
    setRefData((prev) => ({ ...prev, parties: [newParty, ...(prev.parties ?? [])] }));
    setPartyId(newParty.id);
  }

  function applyScanPayload(p) {
    const scannedDate = p.creditNoteDate || p.debitNoteDate;
    if (scannedDate && isIsoDate(String(scannedDate))) setDate(String(scannedDate));
    if (p.partyId) setPartyId(Number(p.partyId));
    if (p.warehouseId) setWarehouseId(Number(p.warehouseId));
    if (p.referenceNo) setReferenceNo(String(p.referenceNo));
    if (p.discType === "amount" || p.discType === "percent") setDiscType(p.discType);
    if (p.discValue != null) setDiscValue(String(p.discValue));
    if (p.isVatApplicable != null) setIsVatApplicable(Boolean(p.isVatApplicable));
    if (p.vatPercent != null) setVatPercent(String(p.vatPercent));
    if (p.isRefunded != null) setIsRefunded(Boolean(p.isRefunded));
    if (p.refundAmount != null) setRefundAmount(String(p.refundAmount));
    if (p.bankAccountId) setBankAccountId(Number(p.bankAccountId));
    if (p.notes) setNotes(String(p.notes));
    if (Array.isArray(p.lines) && p.lines.length > 0) setLines(p.lines.map(normalizeLine));
  }
  const scan = useScanDraft(params.scanDocumentId, applyScanPayload);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const requests = [
      apiFetch("/api/parties"),
      apiFetch("/api/items"),
      apiFetch("/api/mobile/warehouses"),
      apiFetch("/api/mobile/bank-accounts?activeOnly=true").catch(() => []),
      apiFetch("/api/mobile/units").catch(() => []),
      isEdit ? apiFetch(`/api/mobile/${isCredit ? "credit-notes" : "debit-notes"}/${params.id}`) : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([parties, items, warehouses, bankAccounts, units, noteData]) => {
        if (cancelled) return;
        // Same party filtering desktop applies: a credit note goes to a customer, a debit note to a supplier.
        const excluded = isCredit ? "Supplier" : "Customer";
        setRefData({
          parties: (parties ?? []).filter((party) => party.type !== excluded),
          items: items ?? [],
          warehouses: warehouses ?? [],
          bankAccounts: bankAccounts ?? [],
          units: units ?? [],
        });
        if (noteData) {
          const noteDate = isCredit ? noteData.creditNoteDate : noteData.debitNoteDate;
          if (noteDate) setDate(noteDate);
          if (noteData.partyId) setPartyId(Number(noteData.partyId));
          if (noteData.warehouseId) setWarehouseId(Number(noteData.warehouseId));
          if (noteData.referenceNo) setReferenceNo(String(noteData.referenceNo));
          if (noteData.discType) setDiscType(noteData.discType);
          if (noteData.discValue != null) setDiscValue(String(noteData.discValue));
          else if (noteData.discPercent != null) setDiscValue(String(noteData.discPercent));
          else if (noteData.discAmount != null) setDiscValue(String(noteData.discAmount));
          if (noteData.isVatApplicable != null) setIsVatApplicable(Boolean(noteData.isVatApplicable));
          if (noteData.vatPercent != null) setVatPercent(String(noteData.vatPercent));
          if (noteData.isRefunded != null) setIsRefunded(Boolean(noteData.isRefunded));
          if (noteData.refundAmount != null) setRefundAmount(String(noteData.refundAmount));
          if (noteData.bankAccountId) setBankAccountId(Number(noteData.bankAccountId));
          if (noteData.notes) setNotes(String(noteData.notes));
          if (Array.isArray(noteData.lines) && noteData.lines.length > 0) {
            setLines(noteData.lines.map(normalizeLine));
          }
        } else {
          const primary = (warehouses ?? []).find((w) => w.isPrimary);
          if (primary) setWarehouseId((current) => current ?? primary.id);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.messageKey && i18n.exists(err.messageKey) ? t(err.messageKey) : t("forms.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [i18n, isCredit, isEdit, params.id, t]);

  useEffect(() => load(), [load]);

  function resetForm() {
    setDate(todayIsoAd());
    setPartyId(null);
    setWarehouseId(refData.warehouses.find((w) => w.isPrimary)?.id ?? null);
    setReferenceNo("");
    setLines([]);
    setDiscType("percent");
    setDiscValue("0");
    setIsVatApplicable(false);
    setVatPercent("13");
    setIsRefunded(false);
    setRefundAmount("0");
    setBankAccountId(null);
    setNotes("");
    setErrors({});
    setFormError(null);
  }

  const totals = estimateDocumentTotals(lines, { discType, discValue, isVatApplicable, vatPercent });
  const dueEstimate = isRefunded ? round2(totals.totalAmount - toNumber(refundAmount)) : totals.totalAmount;

  function validate() {
    const next = {};
    if (!isIsoDate(date)) next.date = t("forms.dateRequired");
    if (!partyId) next.partyId = t("creditDebit.partyRequired");
    if (!warehouseId) next.warehouseId = t("creditDebit.warehouseRequired");
    if (referenceNo.trim().length > 100) next.referenceNo = t("forms.errors.numberTooLong");
    if (lines.length === 0) next.lines = t("creditDebit.lineRequired");
    if (!isNonNegativeNumber(discValue)) next.discValue = t("forms.amountInvalid");
    else if (discType === "percent" && !isPercent(discValue)) next.discValue = t("forms.percentRange");
    if (isVatApplicable && !isPercent(vatPercent)) next.vatPercent = t("forms.percentRange");
    if (isRefunded && !isNonNegativeNumber(refundAmount)) next.refundAmount = t("forms.amountInvalid");
    return next;
  }

  async function handleSubmit() {
    if (submitting) return;
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    const shared = {
      partyId,
      referenceNo: referenceNo.trim(),
      warehouseId,
      bankAccountId: isRefunded ? bankAccountId || null : null,
      discType,
      discValue: toNumber(discValue),
      isVatApplicable,
      vatPercent: isVatApplicable ? toNumber(vatPercent) : 0,
      isRefunded,
      refundAmount: isRefunded ? toNumber(refundAmount) : 0,
      notes: notes.trim(),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        variantId: null,
        unitId: line.unitId,
        quantity: toNumber(line.quantity),
        rate: toNumber(line.rate),
        discType: line.discType,
        discValue: toNumber(line.discValue),
      })),
    };
    const payload = isCredit ? { creditNoteDate: date, creditNoteType: "sales_return", ...shared } : { debitNoteDate: date, ...shared };

    setSubmitting(true);
    try {
      const path = isEdit
        ? `/api/mobile/${isCredit ? "credit-notes" : "debit-notes"}/${params.id}`
        : `/api/mobile/${isCredit ? "credit-notes" : "debit-notes"}`;
      const method = isEdit ? "PATCH" : "POST";
      await apiFetch(path, { method, body: isEdit ? payload : { ...payload, scanDocumentId: scan.scanId } });
      await scan.consumeDraft();
      showToast(isEdit ? t("creditDebit.savedEdit", { defaultValue: "Note updated" }) : t("creditDebit.saved"), "success");
      if (isEdit) {
        router.replace({ pathname: `/${isCredit ? "credit-notes" : "debit-notes"}/${params.id}`, params: { type: noteType } });
      } else {
        router.replace({ pathname: `/${isCredit ? "credit-notes" : "debit-notes"}`, params: { type: noteType } });
      }
    } catch (err) {
      const described = describeSubmitError(i18n, err, errorNamespaces);
      const fields = { ...described.fields };
      if (fields.creditNoteDate || fields.debitNoteDate) fields.date = fields.creditNoteDate ?? fields.debitNoteDate;
      setErrors(fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit
    ? isCredit
      ? t("creditDebit.creditEditTitle", { defaultValue: "Edit Credit Note" })
      : t("creditDebit.debitEditTitle", { defaultValue: "Edit Debit Note" })
    : isCredit
    ? t("creditDebit.creditTitle")
    : t("creditDebit.debitTitle");

  return (
    <FormScreen
      title={title}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <ScanDraftBanner draft={scan.draft} onClear={async () => { await scan.clearDraft(); resetForm(); }} />
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <DateField label={t("creditDebit.date")} required value={date} onChange={setDate} error={errors.date} restrictToFiscalYear={true} {...scan.fieldProps(t, "creditNoteDate", "debitNoteDate")} />
        <PickerField
          label={t("creditDebit.party")}
          placeholder={t("creditDebit.selectParty")}
          required
          value={partyId}
          options={refData.parties}
          onSelect={(party) => setPartyId(party.id)}
          onAddNew={() => setQuickPartyOpen(true)}
          addNewLabel={t("parties.createParty", { defaultValue: "+ Add New Party" })}
          error={errors.partyId}
          {...scan.fieldProps(t, "partyId")}
        />
        <PickerField
          label={t("creditDebit.warehouse")}
          placeholder={t("creditDebit.selectWarehouse")}
          required
          value={warehouseId}
          options={refData.warehouses}
          onSelect={(warehouse) => setWarehouseId(warehouse.id)}
          error={errors.warehouseId}
          {...scan.fieldProps(t, "warehouseId")}
        />
        <FormField label={t("forms.referenceNo")} value={referenceNo} onChangeText={setReferenceNo} error={errors.referenceNo} {...scan.fieldProps(t, "referenceNo", "number")} />
      </FormSection>

      <FormSection>
        <LineItemsEditor
          lines={lines}
          items={refData.items}
          units={refData.units}
          onChange={(next) => {
            setLines(next);
            if (errors.lines) setErrors((current) => ({ ...current, lines: undefined }));
          }}
          priceField={isCredit ? "sellingPrice" : "purchasePrice"}
          error={errors.lines}
          {...scan.fieldProps(t, "lines")}
        />
      </FormSection>

      <FormSection title={t("forms.estimatedTotals")}>
        <DiscountField value={discValue} type={discType} onChangeValue={setDiscValue} onChangeType={setDiscType} error={errors.discValue} {...scan.fieldProps(t, "discValue")} />
        <SwitchRow label={t("creditDebit.vat")} value={isVatApplicable} onValueChange={setIsVatApplicable} />
        {isVatApplicable ? (
          <FormField label={t("creditDebit.vatPercent")} value={vatPercent} onChangeText={setVatPercent} keyboardType="decimal-pad" suffix={t("sale.discountPercent")} error={errors.vatPercent} {...scan.fieldProps(t, "vatPercent")} />
        ) : null}
        <MoneySummary
          rows={[
            { key: "subtotal", label: t("forms.subtotal"), value: totals.subtotal },
            { key: "discount", label: t("forms.discount"), formatted: `− ${formatNpr(totals.discAmount)}` },
            ...(isVatApplicable ? [{ key: "vat", label: `${t("forms.vat")} (${toNumber(vatPercent)}%)`, value: totals.vatAmount }] : []),
          ]}
          totalLabel={t("forms.grandTotal")}
          totalValue={totals.totalAmount}
          dueLabel={isRefunded ? t("forms.due") : undefined}
          dueValue={dueEstimate}
          style={styles.totals}
        />
        <Text style={styles.estimateNote}>{t("forms.estimateNote")}</Text>
      </FormSection>

      <FormSection title={t("forms.settlementSectionTitle")}>
        <SwitchRow label={t("forms.settlementRefundedToggle")} value={isRefunded} onValueChange={setIsRefunded} />
        {isRefunded ? (
          <>
            <FormField
              label={t("forms.settlementRefundedAmount")}
              value={refundAmount}
              onChangeText={setRefundAmount}
              keyboardType="decimal-pad"
              prefix={t("sale.discountAmount")}
              error={errors.refundAmount}
              {...scan.fieldProps(t, "refundAmount", "amount", "totalAmount")}
            />
            <PickerField
              label={t("forms.bankAccount")}
              placeholder={t("forms.cashNoBankAccount")}
              value={bankAccountId}
              options={refData.bankAccounts}
              getLabel={bankAccountLabel}
              onSelect={(account) => setBankAccountId(account.id)}
              onClear={() => setBankAccountId(null)}
              error={errors.bankAccountId}
              {...scan.fieldProps(t, "bankAccountId")}
            />
          </>
        ) : null}
      </FormSection>

      <FormSection title={t("forms.additionalInformation")}>
        <FormField label={t("creditDebit.notes")} value={notes} onChangeText={setNotes} multiline {...scan.fieldProps(t, "notes")} />
      </FormSection>

      <View style={styles.bottomSpacer} />

      <QuickPartyModal
        visible={quickPartyOpen}
        onClose={() => setQuickPartyOpen(false)}
        defaultType={isCredit ? "Customer" : "Supplier"}
        onPartyCreated={handlePartyCreated}
        prefill={scanPartyPrefill(scan.draft)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  totals: { marginTop: 4, marginBottom: 6 },
  estimateNote: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  bottomSpacer: { height: 8 },
});
