import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { createEntity, updateEntity } from "../lib/offline/sync";
import { useScanDraft, scanPartyPrefill } from "../lib/scanDraftReview";
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
import QuickPartyModal from "../components/QuickPartyModal";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Fields mirror salesInvoiceInputSchema exactly (starterkit/shared/
 * sales-invoices/schema.ts) — same names, same required/optional split, in
 * desktop document-form.tsx's order: date → party → warehouse → lines →
 * discount/VAT + totals → settlement (isReceived / receivedAmount /
 * bankAccountId) → notes. Not exposed here: billingName/billingAddress/
 * panNumber (desktop keeps them in a secondary "billing details" modal and
 * defaults them from the party server-side) and creditTermId (no mobile
 * credit-terms endpoint exists yet — see the report). Both are optional in
 * the schema, so omitting them still produces the same document desktop
 * would with those left blank.
 *
 * Totals shown here are DISPLAY-ONLY estimates (lib/documentTotals.js);
 * createSalesInvoice() recomputes everything server-side (../AGENTS.md §5)
 * — this never posts a total.
 *
 * `partyId` and `scanDocumentId` route params come from Scan Receipt; the
 * draft is read via lib/scanDraftReview.js and every prefilled-but-uncertain
 * field is flagged inline plus in the banner.
 */
const ERROR_NAMESPACES = ["sale"];

export default function CreateSaleScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const isEdit = Boolean(params.id);

  const [refData, setRefData] = useState({ parties: [], items: [], warehouses: [], bankAccounts: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [invoiceDate, setInvoiceDate] = useState(todayIsoAd());
  const [partyId, setPartyId] = useState(params.partyId ? Number(params.partyId) : null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [lines, setLines] = useState([]);
  const [discType, setDiscType] = useState("percent");
  const [discValue, setDiscValue] = useState("0");
  const [isVatApplicable, setIsVatApplicable] = useState(false);
  const [vatPercent, setVatPercent] = useState("13");
  const [isReceived, setIsReceived] = useState(true);
  const [receivedAmount, setReceivedAmount] = useState("0");
  const [bankAccountId, setBankAccountId] = useState(null);
  const [notes, setNotes] = useState("");
  const [quickPartyOpen, setQuickPartyOpen] = useState(false);

  function handlePartyCreated(newParty) {
    setRefData((prev) => ({
      ...prev,
      parties: [newParty, ...(prev.parties ?? [])],
    }));
    setPartyId(newParty.id);
  }

  function applyScanPayload(p) {
    if (p.invoiceDate && isIsoDate(String(p.invoiceDate))) setInvoiceDate(String(p.invoiceDate));
    if (p.partyId) setPartyId(Number(p.partyId));
    if (p.warehouseId) setWarehouseId(Number(p.warehouseId));
    if (p.discType === "amount" || p.discType === "percent") setDiscType(p.discType);
    if (p.discValue != null) setDiscValue(String(p.discValue));
    if (p.isVatApplicable != null) setIsVatApplicable(Boolean(p.isVatApplicable));
    if (p.vatPercent != null) setVatPercent(String(p.vatPercent));
    if (p.isReceived != null) setIsReceived(Boolean(p.isReceived));
    if (p.receivedAmount != null) setReceivedAmount(String(p.receivedAmount));
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
      isEdit ? apiFetch(`/api/mobile/sales-invoices/${params.id}`) : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([parties, items, warehouses, bankAccounts, units, invoiceData]) => {
        if (cancelled) return;
        setRefData({ parties: parties ?? [], items: items ?? [], warehouses: warehouses ?? [], bankAccounts: bankAccounts ?? [], units: units ?? [] });
        if (invoiceData?.invoice) {
          const inv = invoiceData.invoice;
          if (inv.invoiceDate) setInvoiceDate(inv.invoiceDate);
          if (inv.partyId) setPartyId(Number(inv.partyId));
          if (inv.warehouseId) setWarehouseId(Number(inv.warehouseId));
          if (inv.discType) setDiscType(inv.discType);
          if (inv.discValue != null) setDiscValue(String(inv.discValue));
          else if (inv.discPercent != null) setDiscValue(String(inv.discPercent));
          else if (inv.discAmount != null) setDiscValue(String(inv.discAmount));
          if (inv.isVatApplicable != null) setIsVatApplicable(Boolean(inv.isVatApplicable));
          if (inv.vatPercent != null) setVatPercent(String(inv.vatPercent));
          if (inv.isReceived != null) setIsReceived(Boolean(inv.isReceived));
          if (inv.receivedAmount != null) setReceivedAmount(String(inv.receivedAmount));
          if (inv.bankAccountId) setBankAccountId(Number(inv.bankAccountId));
          if (inv.notes) setNotes(String(inv.notes));
        } else {
          const primary = (warehouses ?? []).find((w) => w.isPrimary);
          if (primary) setWarehouseId((current) => current ?? primary.id);
        }
        if (Array.isArray(invoiceData?.lines) && invoiceData.lines.length > 0) {
          setLines(invoiceData.lines.map(normalizeLine));
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
  }, [i18n, isEdit, params.id, t]);

  useEffect(() => load(), [load]);

  function resetForm() {
    setInvoiceDate(todayIsoAd());
    setPartyId(null);
    setWarehouseId(refData.warehouses.find((w) => w.isPrimary)?.id ?? null);
    setLines([]);
    setDiscType("percent");
    setDiscValue("0");
    setIsVatApplicable(false);
    setVatPercent("13");
    setIsReceived(true);
    setReceivedAmount("0");
    setBankAccountId(null);
    setNotes("");
    setErrors({});
    setFormError(null);
  }

  const totals = estimateDocumentTotals(lines, { discType, discValue, isVatApplicable, vatPercent });
  const dueEstimate = isReceived ? round2(totals.totalAmount - toNumber(receivedAmount)) : totals.totalAmount;

  function validate() {
    const next = {};
    if (!isIsoDate(invoiceDate)) next.invoiceDate = t("forms.dateRequired");
    if (!partyId) next.partyId = t("sale.partyRequired");
    if (!warehouseId) next.warehouseId = t("sale.warehouseRequired");
    if (lines.length === 0) next.lines = t("sale.atLeastOneLineRequired");
    if (!isNonNegativeNumber(discValue)) next.discValue = t("forms.amountInvalid");
    else if (discType === "percent" && !isPercent(discValue)) next.discValue = t("forms.percentRange");
    if (isVatApplicable && !isPercent(vatPercent)) next.vatPercent = t("forms.percentRange");
    if (isReceived && !isNonNegativeNumber(receivedAmount)) next.receivedAmount = t("forms.amountInvalid");
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

    const payload = {
      invoiceDate,
      partyId,
      warehouseId,
      bankAccountId: isReceived ? bankAccountId || null : null,
      discType,
      discValue: toNumber(discValue),
      isVatApplicable,
      vatPercent: isVatApplicable ? toNumber(vatPercent) : 0,
      isReceived,
      receivedAmount: isReceived ? toNumber(receivedAmount) : 0,
      notes: notes.trim(),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: toNumber(line.quantity),
        rate: toNumber(line.rate),
        discType: line.discType,
        discValue: toNumber(line.discValue),
      })),
    };

    setSubmitting(true);
    try {
      const fullPayload = isEdit ? payload : { ...payload, scanDocumentId: scan.scanId };
      const res = isEdit
        ? await updateEntity("/api/mobile/sales-invoices", "sales_invoices", params.id, fullPayload)
        : await createEntity("/api/mobile/sales-invoices", "sales_invoices", fullPayload);

      try {
        await scan.consumeDraft();
      } catch {}

      if (res?.queued) {
        showToast(t("offline.savedOffline", { defaultValue: "Saved offline. Will sync once connected." }), "warning");
        router.replace("/sales");
        return;
      }

      showToast(isEdit ? t("sale.savedEditTitle", { defaultValue: "Sale invoice updated" }) : t("sale.savedTitle"), "success");
      const redirectId = isEdit ? params.id : res?.data?.id;
      router.replace(redirectId ? `/sales/${redirectId}` : "/sales");
    } catch (err) {
      const described = describeSubmitError(i18n, err, ERROR_NAMESPACES);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit ? t("sale.editTitle", { defaultValue: "Edit Sale" }) : t("sale.createTitle");

  return (
    <FormScreen
      title={title}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("sale.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <ScanDraftBanner draft={scan.draft} onClear={async () => { await scan.clearDraft(); resetForm(); }} />
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <DateField label={t("sale.date")} required value={invoiceDate} onChange={setInvoiceDate} error={errors.invoiceDate} restrictToFiscalYear={true} {...scan.fieldProps(t, "invoiceDate")} />
        <View style={styles.partyHeaderRow}>
          <Text style={styles.fieldLabel}>
            {t("sale.party")} <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.inlineAddPartyBtn}
            onPress={() => setQuickPartyOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Feather name="user-plus" size={13} color={colors.primary} />
            <Text style={styles.inlineAddPartyText}>
              + {t("parties.createParty", { defaultValue: "Add Party" })}
            </Text>
          </TouchableOpacity>
        </View>
        <PickerField
          placeholder={t("sale.selectParty")}
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
          label={t("forms.warehouse")}
          placeholder={t("sale.selectWarehouse")}
          required
          value={warehouseId}
          options={refData.warehouses}
          onSelect={(warehouse) => setWarehouseId(warehouse.id)}
          error={errors.warehouseId}
          {...scan.fieldProps(t, "warehouseId")}
        />
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
          priceField="sellingPrice"
          error={errors.lines}
          {...scan.fieldProps(t, "lines")}
        />
      </FormSection>

      <FormSection title={t("forms.estimatedTotals")}>
        <DiscountField value={discValue} type={discType} onChangeValue={setDiscValue} onChangeType={setDiscType} error={errors.discValue} {...scan.fieldProps(t, "discValue")} />
        <SwitchRow label={t("sale.vatApplicable")} value={isVatApplicable} onValueChange={setIsVatApplicable} />
        {isVatApplicable ? (
          <FormField label={t("sale.vatPercent")} value={vatPercent} onChangeText={setVatPercent} keyboardType="decimal-pad" suffix={t("sale.discountPercent")} error={errors.vatPercent} {...scan.fieldProps(t, "vatPercent")} />
        ) : null}
        <MoneySummary
          rows={[
            { key: "subtotal", label: t("forms.subtotal"), value: totals.subtotal },
            { key: "discount", label: t("forms.discount"), formatted: `− ${formatNpr(totals.discAmount)}` },
            ...(isVatApplicable ? [{ key: "vat", label: `${t("forms.vat")} (${toNumber(vatPercent)}%)`, value: totals.vatAmount }] : []),
          ]}
          totalLabel={t("forms.grandTotal")}
          totalValue={totals.totalAmount}
          dueLabel={isReceived ? t("forms.due") : undefined}
          dueValue={dueEstimate}
          style={styles.totals}
        />
        <Text style={styles.estimateNote}>{t("forms.estimateNote")}</Text>
      </FormSection>

      <FormSection title={t("forms.settlementSectionTitle")}>
        <SwitchRow label={t("forms.settlementReceivedToggle")} value={isReceived} onValueChange={setIsReceived} />
        {isReceived ? (
          <>
            <FormField
              label={t("forms.settlementReceivedAmount")}
              value={receivedAmount}
              onChangeText={setReceivedAmount}
              keyboardType="decimal-pad"
              prefix={t("sale.discountAmount")}
              error={errors.receivedAmount}
              {...scan.fieldProps(t, "receivedAmount", "amount", "totalAmount")}
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
        <FormField label={t("forms.notes")} value={notes} onChangeText={setNotes} multiline {...scan.fieldProps(t, "notes")} />
      </FormSection>

      <View style={styles.bottomSpacer} />

      <QuickPartyModal
        visible={quickPartyOpen}
        onClose={() => setQuickPartyOpen(false)}
        defaultType="Customer"
        onPartyCreated={handlePartyCreated}
        prefill={scanPartyPrefill(scan.draft)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  partyHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  fieldLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted },
  required: { color: colors.danger },
  inlineAddPartyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, backgroundColor: "rgba(152,95,253,0.08)" },
  inlineAddPartyText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary },
  totals: { marginTop: 4, marginBottom: 6 },
  estimateNote: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  bottomSpacer: { height: 8 },
});
