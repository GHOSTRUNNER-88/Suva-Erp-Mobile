import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { isNonNegativeNumber, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";

export default function CreateStockAdjustmentScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [refData, setRefData] = useState({ items: [], warehouses: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [itemId, setItemId] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      apiFetch("/api/items"),
      apiFetch("/api/mobile/warehouses"),
    ])
      .then(([items, warehouses]) => {
        if (cancelled) return;
        setRefData({
          items: items ?? [],
          warehouses: warehouses ?? [],
        });
        const primary = (warehouses ?? []).find((w) => w.isPrimary);
        if (primary) setWarehouseId((current) => current ?? primary.id);
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
  }, [i18n, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (submitting) return;
    setFormError(null);
    const next = {};
    if (!itemId) next.itemId = t("inventory.itemRequired", { defaultValue: "Item is required" });
    if (!warehouseId) next.warehouseId = t("inventory.warehouseRequired", { defaultValue: "Warehouse is required" });
    if (!quantity || !isNonNegativeNumber(quantity)) next.quantity = t("inventory.quantityInvalid", { defaultValue: "Quantity must be 0 or more" });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/mobile/inventory/adjustments", {
        method: "POST",
        body: {
          itemId,
          warehouseId,
          quantity: toNumber(quantity),
          note: note.trim(),
        },
      });
      showToast(t("inventory.adjustmentSaved", { defaultValue: "Stock adjusted successfully" }), "success");
      router.replace("/inventory/adjustments");
    } catch (err) {
      const described = describeSubmitError(i18n, err, ["inventory", "forms"]);
      setErrors(described.fields);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={t("inventory.adjustStockTitle", { defaultValue: "Adjust Stock" })}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <PickerField
          label={t("inventory.selectItem", { defaultValue: "Item" })}
          placeholder={t("inventory.chooseItem", { defaultValue: "Select item" })}
          required
          value={itemId}
          options={refData.items}
          onSelect={(item) => setItemId(item.id)}
          error={errors.itemId}
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
        <FormField
          label={t("inventory.newCountedQuantity", { defaultValue: "New Counted Stock Quantity" })}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="0"
          required
          error={errors.quantity}
        />
        <FormField
          label={t("forms.notes")}
          value={note}
          onChangeText={setNote}
          placeholder={t("inventory.reasonPlaceholder", { defaultValue: "Reason for adjustment (e.g. audit, damage, found stock)..." })}
          multiline
          numberOfLines={2}
        />
      </FormSection>
    </FormScreen>
  );
}