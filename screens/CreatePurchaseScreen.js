import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { createEntity, updateEntity } from "../lib/offline/sync";
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
 * Fields mirror purchaseBillInputSchema's core (domestic) path — see
 * app/api/mobile/purchase-bills/route.ts for why every import/customs field
 * is omitted (all zod-defaulted, so this still produces a valid bill, just
 * not an import one; import purchases stay desktop-only). Order follows
 * desktop's document-form: bill number + date → supplier → warehouse →
 * lines → discount/VAT + totals → settlement (isPaid / paidAmount /
 * bankAccountId) → notes. supplierName/supplierAddress/panNumber and
 * creditTermId are optional and not exposed here (same reasoning as
 * CreateSaleScreen).
 *
 * Totals are DISPLAY-ONLY estimates; createPurchaseBill() recomputes
 * server-side (../AGENTS.md §5).
 */
const ERROR_NAMESPACES = ["purchase", "sale"];

export default function CreatePurchaseScreen() {
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

  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(todayIsoAd());
  const [partyId, setPartyId] = useState(params.partyId ? Number(params.partyId) : null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [lines, setLines] = useState([]);
  const [discType, setDiscType] = useState("percent");
  const [discValue, setDiscValue] = useState("0");
  const [isVatApplicable, setIsVatApplicable] = useState(false);
  const [vatPercent, setVatPercent] = useState("13");
  const [isPaid, setIsPaid] = useState(true);
  const [paidAmount, setPaidAmount] = useState("0");
  const [bankAccountId, setBankAccountId] = useState(null);
  const [notes, setNotes] = useState("");

  const [quickPartyOpen, setQuickPartyOpen] = useState(false);

  function handlePartyCreated(newParty) {
    setRefData((prev) => ({ ...prev, parties: [newParty, ...(prev.parties ?? [])] }));
    setPartyId(newParty.id);
  }

  function applyScanPayload(p) {
    if (p.billNumber) setBillNumber(String(p.billNumber));
    if (p.billDate && isIsoDate(String(p.billDate))) setBillDate(String(p.billDate));
    if (p.partyId) setPartyId(Number(p.partyId));
    if (p.warehouseId) setWarehouseId(Number(p.warehouseId));
    if (p.discType === "amount" || p.discType === "percent") setDiscType(p.discType);
    if (p.discValue != null) setDiscValue(String(p.discValue));
    if (p.isVatApplicable != null) setIsVatApplicable(Boolean(p.isVatApplicable));
    if (p.vatPercent != null) setVatPercent(String(p.vatPercent));
    if (p.isPaid != null) setIsPaid(Boolean(p.isPaid));
    if (p.paidAmount != null) setPaidAmount(String(p.paidAmount));
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
      isEdit ? apiFetch(`/api/mobile/purchase-bills/${params.id}`) : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([parties, items, warehouses, bankAccounts, units, billData]) => {
        if (cancelled) return;
        setRefData({ parties: parties ?? [], items: items ?? [], warehouses: warehouses ?? [], bankAccounts: bankAccounts ?? [], units: units ?? [] });
        const bill = billData?.bill ?? billData?.invoice;
        if (bill) {
          if (bill.billNumber) setBillNumber(bill.billNumber);
          if (bill.billDate) setBillDate(bill.billDate);
          if (bill.partyId) setPartyId(Number(bill.partyId));
          if (bill.warehouseId) setWarehouseId(Number(bill.warehouseId));
          if (bill.discType) setDiscType(bill.discType);
          if (bill.discValue != null) setDiscValue(String(bill.discValue));
          else if (bill.discPercent != null) setDiscValue(String(bill.discPercent));
          else if (bill.discAmount != null) setDiscValue(String(bill.discAmount));
          if (bill.isVatApplicable != null) setIsVatApplicable(Boolean(bill.isVatApplicable));
          if (bill.vatPercent != null) setVatPercent(String(bill.vatPercent));
          if (bill.isPaid != null) setIsPaid(Boolean(bill.isPaid));
          if (bill.paidAmount != null) setPaidAmount(String(bill.paidAmount));
          if (bill.bankAccountId) setBankAccountId(Number(bill.bankAccountId));
          if (bill.notes) setNotes(String(bill.notes));
        } else {
          const primary = (warehouses ?? []).find((w) => w.isPrimary);
          if (primary) setWarehouseId((current) => current ?? primary.id);
        }
        if (Array.isArray(billData?.lines) && billData.lines.length > 0) {
          setLines(billData.lines.map(normalizeLine));
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
    setBillNumber("");
    setBillDate(todayIsoAd());
    setPartyId(null);
    setWarehouseId(refData.warehouses.find((w) => w.isPrimary)?.id ?? null);
    setLines([]);
    setDiscType("percent");
    setDiscValue("0");
    setIsVatApplicable(false);
    setVatPercent("13");
    setIsPaid(true);
    setPaidAmount("0");
    setBankAccountId(null);
    setNotes("");
    setErrors({});
    setFormError(null);
  }

  const totals = estimateDocumentTotals(lines, { discType, discValue, isVatApplicable, vatPercent });
  const dueEstimate = isPaid ? round2(totals.totalAmount - toNumber(paidAmount)) : totals.totalAmount;

  function validate() {
    const next = {};
    if (!billNumber.trim()) next.billNumber = t("forms.errors.numberRequired");
    else if (billNumber.trim().length > 50) next.billNumber = t("forms.errors.numberTooLong");
    if (!isIsoDate(billDate)) next.billDate = t("forms.dateRequired");
    if (!partyId) next.partyId = t("sale.partyRequired");
    if (!warehouseId) next.warehouseId = t("sale.warehouseRequired");
    if (lines.length === 0) next.lines = t("sale.atLeastOneLineRequired");
    if (!isNonNegativeNumber(discValue)) next.discValue = t("forms.amountInvalid");
    else if (discType === "percent" && !isPercent(discValue)) next.discValue = t("forms.percentRange");
    if (isVatApplicable && !isPercent(vatPercent)) next.vatPercent = t("forms.percentRange");
    if (isPaid && !isNonNegativeNumber(paidAmount)) next.paidAmount = t("forms.amountInvalid");
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
      billNumber: billNumber.trim(),
      billDate,
      partyId,
      warehouseId,
      bankAccountId: isPaid ? bankAccountId || null : null,
      discType,
      discValue: toNumber(discValue),
      isVatApplicable,
      vatPercent: isVatApplicable ? toNumber(vatPercent) : 0,
      isPaid,
      paidAmount: isPaid ? toNumber(paidAmount) : 0,
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
        ? await updateEntity("/api/mobile/purchase-bills", "purchase_bills", params.id, fullPayload)
        : await createEntity("/api/mobile/purchase-bills", "purchase_bills", fullPayload);

      try {
        await scan.consumeDraft();
      } catch {}

      if (res?.queued) {
        showToast(t("offline.savedOffline", { defaultValue: "Saved offline. Will sync once connected." }), "warning");
        router.replace("/purchases");
        return;
      }

      showToast(isEdit ? t("purchase.savedEditTitle", { defaultValue: "Purchase bill updated" }) : t("forms.saved"), "success");
      const redirectId = isEdit ? params.id : res?.data?.id;
      router.replace(redirectId ? `/purchases/${redirectId}` : "/purchases");
    } catch (err) {
      const described = describeSubmitError(i18n, err, ERROR_NAMESPACES);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit ? t("purchase.editTitle", { defaultValue: "Edit Purchase" }) : t("purchase.createTitle");

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
        <FormField label={t("purchase.billNumber")} required value={billNumber} onChangeText={setBillNumber} error={errors.billNumber} autoCapitalize="characters" {...scan.fieldProps(t, "billNumber", "number")} />
        <DateField label={t("purchase.billDate")} required value={billDate} onChange={setBillDate} error={errors.billDate} restrictToFiscalYear={true} {...scan.fieldProps(t, "billDate")} />
        <PickerField
          label={t("purchase.supplier")}
          placeholder={t("purchase.selectSupplier")}
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
          priceField="purchasePrice"
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
          dueLabel={isPaid ? t("forms.due") : undefined}
          dueValue={dueEstimate}
          style={styles.totals}
        />
        <Text style={styles.estimateNote}>{t("forms.estimateNote")}</Text>
      </FormSection>

      <FormSection title={t("forms.settlementSectionTitle")}>
        <SwitchRow label={t("forms.settlementPaidToggle")} value={isPaid} onValueChange={setIsPaid} />
        {isPaid ? (
          <>
            <FormField
              label={t("forms.settlementPaidAmount")}
              value={paidAmount}
              onChangeText={setPaidAmount}
              keyboardType="decimal-pad"
              prefix={t("sale.discountAmount")}
              error={errors.paidAmount}
              {...scan.fieldProps(t, "paidAmount", "amount", "totalAmount")}
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
        defaultType="Supplier"
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
