import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { isIsoDate, toNumber } from "../lib/documentTotals";
import { describeSubmitError } from "../lib/formErrors";
import { todayIsoAd } from "../lib/bs-ad";
import FormScreen, { FormSection } from "../components/ui/FormScreen";
import StickyActionBar from "../components/ui/StickyActionBar";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import { InlineError } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import PickerField from "../components/PickerField";
import LineItemsEditor from "../components/LineItemsEditor";

export default function CreateInventoryTransferScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [refData, setRefData] = useState({ items: [], warehouses: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [transferDate, setTransferDate] = useState(todayIsoAd());
  const [fromWarehouseId, setFromWarehouseId] = useState(null);
  const [toWarehouseId, setToWarehouseId] = useState(null);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      apiFetch("/api/items"),
      apiFetch("/api/mobile/warehouses"),
      apiFetch("/api/mobile/units").catch(() => []),
    ])
      .then(([items, warehouses, units]) => {
        if (cancelled) return;
        setRefData({
          items: items ?? [],
          warehouses: warehouses ?? [],
          units: units ?? [],
        });
        const primary = (warehouses ?? []).find((w) => w.isPrimary);
        if (primary) setFromWarehouseId((current) => current ?? primary.id);
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
    if (!isIsoDate(transferDate)) next.transferDate = t("forms.dateRequired");
    if (!fromWarehouseId) next.fromWarehouseId = t("inventory.fromWarehouseRequired", { defaultValue: "Source warehouse is required" });
    if (!toWarehouseId) next.toWarehouseId = t("inventory.toWarehouseRequired", { defaultValue: "Destination warehouse is required" });
    if (fromWarehouseId && toWarehouseId && fromWarehouseId === toWarehouseId) {
      next.toWarehouseId = t("inventory.sameWarehouseError", { defaultValue: "Source and destination warehouse cannot be the same" });
    }
    if (lines.length === 0) next.lines = t("forms.atLeastOneLineRequired", { defaultValue: "Add at least one item to transfer" });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t("forms.fixErrors"));
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/mobile/inventory/transfers", {
        method: "POST",
        body: {
          transferDate,
          fromWarehouseId,
          toWarehouseId,
          note: note.trim(),
          lines: lines.map((l) => ({
            itemId: l.itemId,
            unitId: l.unitId,
            quantity: String(toNumber(l.quantity)),
          })),
        },
      });
      showToast(t("inventory.transferSaved", { defaultValue: "Inventory transferred successfully" }), "success");
      router.replace("/inventory/transfers");
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
      title={t("inventory.transferTitle", { defaultValue: "New Stock Transfer" })}
      loading={loading}
      error={loadError}
      onRetry={load}
      footer={<StickyActionBar primaryLabel={t("forms.save")} onPrimary={handleSubmit} loading={submitting} />}
    >
      <InlineError message={formError} />

      <FormSection title={t("forms.detailsHeading")}>
        <DateField label={t("common.date")} required value={transferDate} onChange={setTransferDate} error={errors.transferDate} />
        <PickerField
          label={t("inventory.fromWarehouse", { defaultValue: "From Warehouse" })}
          placeholder={t("sale.selectWarehouse")}
          required
          value={fromWarehouseId}
          options={refData.warehouses}
          onSelect={(w) => setFromWarehouseId(w.id)}
          error={errors.fromWarehouseId}
        />
        <PickerField
          label={t("inventory.toWarehouse", { defaultValue: "To Warehouse" })}
          placeholder={t("sale.selectWarehouse")}
          required
          value={toWarehouseId}
          options={refData.warehouses.filter((w) => w.id !== fromWarehouseId)}
          onSelect={(w) => setToWarehouseId(w.id)}
          error={errors.toWarehouseId}
        />
      </FormSection>

      <FormSection title={t("sale.lineItems")}>
        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          items={refData.items}
          units={refData.units}
          hidePricing={true}
          error={errors.lines}
        />
      </FormSection>

      <FormSection title={t("forms.notes")}>
        <FormField
          label={t("forms.notes")}
          value={note}
          onChangeText={setNote}
          placeholder={t("forms.notesPlaceholder", { defaultValue: "Add transfer notes..." })}
          multiline
          numberOfLines={2}
        />
      </FormSection>
    </FormScreen>
  );
}