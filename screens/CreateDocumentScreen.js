import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { estimateDocumentTotals, isNonNegativeNumber, isPercent, isIsoDate, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
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

export default function CreateDocumentScreen({
  docType,
  createTitle,
  editTitle,
  endpoint,
  partyTypeFilter = "Customer",
  dateFieldProp = "orderDate",
  hasPricing = true,
  hasDeliveryToggle = false,
  successRedirectPrefix,
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const isEdit = Boolean(params.id);

  const [refData, setRefData] = useState({ parties: [], items: [], warehouses: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [docNumber, setDocNumber] = useState("");
  const [date, setDate] = useState(todayIsoAd());
  const [partyId, setPartyId] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [lines, setLines] = useState([]);
  const [discType, setDiscType] = useState("percent");
  const [discValue, setDiscValue] = useState("0");
  const [isVatApplicable, setIsVatApplicable] = useState(false);
  const [vatPercent, setVatPercent] = useState("13");
  const [deductStock, setDeductStock] = useState(true);
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const requests = [
      apiFetch("/api/parties"),
      apiFetch("/api/items"),
      apiFetch("/api/mobile/warehouses"),
      apiFetch("/api/mobile/units").catch(() => []),
      isEdit ? apiFetch(`${endpoint}/${params.id}`) : Promise.resolve(null),
    ];

    Promise.all(requests)
      .then(([parties, items, warehouses, units, existingData]) => {
        if (cancelled) return;
        const filteredParties = (parties ?? []).filter((p) => {
          if (partyTypeFilter === "Customer") return p.type === "Customer" || p.type === "Both";
          if (partyTypeFilter === "Supplier") return p.type === "Supplier" || p.type === "Both";
          return true;
        });

        setRefData({
          parties: filteredParties,
          items: items ?? [],
          warehouses: warehouses ?? [],
          units: units ?? [],
        });

        const doc = existingData?.order || existingData?.quotation || existingData?.challan || existingData;
        if (doc && doc.id) {
          if (doc.orderNumber || doc.quotationNumber || doc.challanNumber) {
            setDocNumber(doc.orderNumber || doc.quotationNumber || doc.challanNumber);
          }
          const d = doc.orderDate || doc.quotationDate || doc.challanDate || doc.date;
          if (d) setDate(String(d).slice(0, 10));
          if (doc.partyId) setPartyId(Number(doc.partyId));
          if (doc.warehouseId) setWarehouseId(Number(doc.warehouseId));
          if (doc.discType) setDiscType(doc.discType);
          if (doc.discValue != null) setDiscValue(String(doc.discValue));
          else if (doc.discPercent != null) setDiscValue(String(doc.discPercent));
          else if (doc.discAmount != null) setDiscValue(String(doc.discAmount));
          if (doc.isVatApplicable != null) setIsVatApplicable(Boolean(doc.isVatApplicable));
          if (doc.vatPercent != null) setVatPercent(String(doc.vatPercent));
          if (doc.deductStock != null || doc.stockDeducted != null) setDeductStock(Boolean(doc.deductStock ?? doc.stockDeducted));
          if (doc.notes) setNotes(String(doc.notes));
          if (Array.isArray(existingData?.lines) && existingData.lines.length > 0) {
            setLines(existingData.lines.map(normalizeLine));
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
  }, [endpoint, i18n, isEdit, params.id, partyTypeFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = hasPricing ? estimateDocumentTotals(lines, { discType, discValue, isVatApplicable, vatPercent }) : null;

  async function handleSubmit() {
    if (submitting) return;
    setFormError(null);
    const next = {};
    if (!isIsoDate(date)) next.date = t("forms.dateRequired");
    if (!partyId) next.partyId = t("forms.partyRequired", { defaultValue: "Party is required." });
    if (!warehouseId) next.warehouseId = t("forms.warehouseRequired", { defaultValue: "Warehouse is required." });
    if (lines.length === 0) next.lines = t("forms.atLeastOneLineRequired", { defaultValue: "Add at least one item." });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    const payload = {
      partyId,
      warehouseId,
      notes: notes.trim(),
      [dateFieldProp]: date,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: toNumber(line.quantity),
        rate: hasPricing ? toNumber(line.rate) : 0,
        discType: line.discType || "percent",
        discValue: hasPricing ? toNumber(line.discValue) : 0,
      })),
    };

    if (docNumber.trim()) {
      if (docType === "sales-orders") payload.orderNumber = docNumber.trim();
      else if (docType === "sales-quotations") payload.quotationNumber = docNumber.trim();
      else if (docType === "delivery-challans") payload.challanNumber = docNumber.trim();
      else if (docType === "purchase-orders") payload.orderNumber = docNumber.trim();
    }

    if (hasPricing) {
      payload.discType = discType;
      payload.discValue = toNumber(discValue);
      payload.isVatApplicable = isVatApplicable;
      payload.vatPercent = isVatApplicable ? toNumber(vatPercent) : 0;
      payload.status = "draft";
    }

    if (hasDeliveryToggle) {
      payload.deductStock = deductStock;
    }

    setSubmitting(true);
    try {
      const url = isEdit ? `${endpoint}/${params.id}` : endpoint;
      const method = isEdit ? "PATCH" : "POST";
      const result = await apiFetch(url, { method, body: payload });
      showToast(t("forms.saved", { defaultValue: "Saved successfully" }), "success");
      const redirectId = isEdit ? params.id : result?.id;
      if (redirectId) {
        router.replace(`${successRedirectPrefix}/${redirectId}`);
      } else {
        router.replace(successRedirectPrefix);
      }
    } catch (err) {
      const described = describeSubmitError(i18n, err, ["forms", "sale"]);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit ? editTitle : createTitle;

  return (
    <FormScreen
      title={title}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <DateField label={t("common.date")} required value={date} onChange={setDate} error={errors.date} restrictToFiscalYear={true} />
        <PickerField
          label={t("sale.party")}
          placeholder={t("sale.selectParty")}
          required
          value={partyId}
          options={refData.parties}
          onSelect={(party) => setPartyId(party.id)}
          error={errors.partyId}
        />
        <PickerField
          label={t("forms.warehouse")}
          placeholder={t("sale.selectWarehouse")}
          required
          value={warehouseId}
          options={refData.warehouses}
          onSelect={(w) => setWarehouseId(w.id)}
          error={errors.warehouseId}
        />
      </FormSection>

      <FormSection title={t("sale.lineItems")}>
        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          items={refData.items}
          units={refData.units}
          priceField={partyTypeFilter === "Vendor" ? "purchasePrice" : "sellingPrice"}
          hidePricing={!hasPricing}
          error={errors.lines}
        />
      </FormSection>

      {hasPricing && totals ? (
        <FormSection title={t("sale.totalsHeading", { defaultValue: "Totals" })}>
          <DiscountField
            discType={discType}
            discValue={discValue}
            onChangeType={setDiscType}
            onChangeValue={setDiscValue}
            error={errors.discValue}
          />
          <SwitchRow
            label={t("sale.vatApplicable")}
            value={isVatApplicable}
            onValueChange={setIsVatApplicable}
          />
          {isVatApplicable ? (
            <FormField
              label={t("sale.vatPercent")}
              value={vatPercent}
              onChangeText={setVatPercent}
              keyboardType="numeric"
              error={errors.vatPercent}
            />
          ) : null}
          <MoneySummary
            rows={[
              { label: t("sale.subtotal"), value: totals.subtotal },
              totals.discAmount > 0 ? { label: t("sale.discount"), value: totals.discAmount } : null,
              totals.vatAmount > 0 ? { label: t("sale.vat"), value: totals.vatAmount } : null,
            ].filter(Boolean)}
            totalLabel={t("sale.total")}
            totalValue={totals.totalAmount}
          />
        </FormSection>
      ) : null}

      {hasDeliveryToggle ? (
        <FormSection title={t("forms.stockAction", { defaultValue: "Stock Action" })}>
          <SwitchRow
            label={t("inventory.deductStock", { defaultValue: "Deduct stock from warehouse" })}
            value={deductStock}
            onValueChange={setDeductStock}
          />
        </FormSection>
      ) : null}

      <FormSection title={t("forms.notes")}>
        <FormField
          label={t("forms.notes")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("forms.notesPlaceholder", { defaultValue: "Add any internal notes..." })}
          multiline
          numberOfLines={3}
        />
      </FormSection>
    </FormScreen>
  );
}