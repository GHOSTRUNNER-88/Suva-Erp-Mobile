import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { savePendingScanItem } from "../lib/scanDrafts";
import ScreenHeader from "../components/ui/ScreenHeader";
import StickyActionBar from "../components/ui/StickyActionBar";
import PickerField from "../components/PickerField";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Fields mirror itemInputSchema (starterkit/shared/items/schema.ts), scoped
 * to the core fields: name, categoryId, primaryUnitId, barcodeValue,
 * hsCode, purchasePrice, sellingPrice. Deliberately not exposed here:
 * secondaryUnitId/conversionFactor (secondary-unit conversion), variant
 * attributeValueIds, and per-party-group price overrides — each is its own
 * real sub-feature (a full attribute/variant picker, a per-group price
 * table), out of scope for this pass. Omitting them sends the schema's own
 * defaults (empty array / null), which is a valid, complete item — not a
 * broken one.
 */
export default function CreateItemScreen() {
  const { t } = useTranslation();
  const { id, returnToScan, scanDocumentId, scanLineIndex, itemName, itemRate } = useLocalSearchParams();
  const isEdit = Boolean(id);

  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [primaryUnitId, setPrimaryUnitId] = useState(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [secondaryUnitId, setSecondaryUnitId] = useState(null);
  const [conversionFactor, setConversionFactor] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");

  // Opening stock, warehouse-wise — mirrors the desktop Add Item form
  // (starterkit shared/@spk-reusable-components/suva/items/items-view.tsx)
  // field for field, per AGENTS.md §1. Create-only on both platforms: the
  // API refuses to re-post an opening for an item that already has
  // movements, so offering it on edit would imply something untrue.
  const [warehouses, setWarehouses] = useState([]);
  const [openingStock, setOpeningStock] = useState({});
  const [openingStockRate, setOpeningStockRate] = useState("");

  useEffect(() => {
    let cancelled = false;
    const requests = [
      apiFetch("/api/mobile/item-categories"),
      apiFetch("/api/mobile/units"),
      isEdit ? apiFetch(`/api/mobile/items/${id}`) : Promise.resolve(null),
      isEdit ? Promise.resolve(null) : apiFetch("/api/mobile/warehouses"),
    ];

    Promise.all(requests)
      .then(([categoriesData, unitsData, itemData, warehousesData]) => {
        if (cancelled) return;
        setCategories(categoriesData ?? []);
        setUnits(unitsData ?? []);
        setWarehouses(warehousesData ?? []);
        if (itemData) {
          setName(itemData.name ?? "");
          setCategoryId(itemData.categoryId ?? null);
          setPrimaryUnitId(itemData.primaryUnitId ?? null);
          setSecondaryUnitId(itemData.secondaryUnitId ?? null);
          setConversionFactor(itemData.conversionFactor != null ? String(itemData.conversionFactor) : "");
          setBarcodeValue(itemData.barcodeValue ?? "");
          setHsCode(itemData.hsCode ?? "");
          setPurchasePrice(String(itemData.purchasePrice ?? 0));
          setSellingPrice(String(itemData.sellingPrice ?? 0));
        } else {
          if (itemName) setName(String(itemName));
          if (itemRate) {
            setSellingPrice(String(itemRate));
            setPurchasePrice(String(itemRate));
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setFormError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    try {
      const result = await apiFetch("/api/mobile/item-categories", { method: "POST", body: { name: newCategoryName.trim(), description: "", icon: "" }, raw: true });
      const category = { id: result.id, name: newCategoryName.trim() };
      setCategories((previous) => [...previous, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(category.id);
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (err) {
      setFormError(err.messageKey ? t(err.messageKey) : t("items.categoryCreateFailed", { defaultValue: "Could not create category." }));
    }
  }

  async function createUnit() {
    if (!newUnitName.trim() || !newUnitCode.trim()) return;
    try {
      const result = await apiFetch("/api/mobile/units", { method: "POST", body: { name: newUnitName.trim(), code: newUnitCode.trim(), type: "" }, raw: true });
      const unit = { id: result.id, name: newUnitName.trim(), code: newUnitCode.trim() };
      setUnits((previous) => [...previous, unit].sort((a, b) => a.name.localeCompare(b.name)));
      setPrimaryUnitId((current) => current ?? unit.id);
      setNewUnitName("");
      setNewUnitCode("");
      setAddingUnit(false);
    } catch (err) {
      setFormError(err.messageKey ? t(err.messageKey) : t("items.unitCreateFailed", { defaultValue: "Could not create unit." }));
    }
  }

  async function handleSubmit() {
    setFormError(null);
    setErrors({});

    const newErrors = {};
    if (!name.trim()) newErrors.name = t("items.nameRequired");
    if (!primaryUnitId) newErrors.primaryUnitId = t("items.unitRequired");
    if (secondaryUnitId && (!conversionFactor || Number(conversionFactor) <= 0)) newErrors.conversionFactor = t("items.conversionFactorRequired", { defaultValue: "Enter a positive conversion factor." });
    if (secondaryUnitId && Number(secondaryUnitId) === Number(primaryUnitId)) newErrors.secondaryUnitId = t("items.secondaryUnitDifferent", { defaultValue: "Choose a different secondary unit." });
    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);

    const payload = {
      name: name.trim(),
      categoryId: categoryId ? Number(categoryId) : null,
      primaryUnitId: Number(primaryUnitId),
      secondaryUnitId: secondaryUnitId ? Number(secondaryUnitId) : null,
      conversionFactor: secondaryUnitId ? Number(conversionFactor || 0) : null,
      barcodeValue: barcodeValue.trim(),
      hsCode: hsCode.trim(),
      purchasePrice: Number(purchasePrice || 0),
      sellingPrice: Number(sellingPrice || 0),
    };

    // Create-only, same rule as desktop. Quantities and the valuation rate go
    // to the API as entered — the server posts the movements and the
    // balancing journal, and nothing about that total is computed here
    // (AGENTS.md §2: mobile trusts the API's answer, never recomputes it).
    if (!isEdit) {
      payload.openingStock = Object.entries(openingStock)
        .filter(([, value]) => String(value).trim() !== "" && Number(value) > 0)
        .map(([warehouseId, value]) => ({ warehouseId: Number(warehouseId), quantity: Number(value) }));
      payload.openingStockRate = Number(openingStockRate || purchasePrice || 0);
    }

    setSubmitting(true);
    try {
      const path = isEdit ? `/api/mobile/items/${id}` : "/api/items";
      const method = isEdit ? "PATCH" : "POST";
      const result = await apiFetch(path, { method, body: payload, raw: true });
      if (isEdit) {
        router.replace({ pathname: `/items/${id}` });
      } else if (returnToScan === "1" && scanDocumentId && scanLineIndex != null && result?.id) {
        await savePendingScanItem(scanDocumentId, scanLineIndex, {
          itemId: result.id,
          unitId: primaryUnitId,
          name: payload.name,
          rate: payload.sellingPrice,
        });
        router.back();
      } else {
        router.replace({ pathname: "/(tabs)/items" });
      }
    } catch (err) {
      if (err.fieldErrors) {
        const flat = {};
        Object.entries(err.fieldErrors).forEach(([key, messages]) => {
          flat[key] = Array.isArray(messages) ? messages[0] : messages;
        });
        setErrors(flat);
      } else {
        setFormError(err.messageKey ? t(err.messageKey) : err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit ? t("items.editTitle", { defaultValue: "Edit Item" }) : t("items.createTitle");

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top", "left", "right"]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={title} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>{t("items.name")}</Text>
              <TextInput style={[styles.input, errors.name && styles.inputError]} value={name} onChangeText={setName} />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <PickerField
              label={t("items.category")}
              placeholder={t("items.selectCategory")}
              value={categoryId}
              options={categories}
              onSelect={(category) => setCategoryId(category.id)}
            />
            <Pressable onPress={() => setAddingCategory((value) => !value)} style={styles.inlineAddToggle} accessibilityRole="button">
              <Text style={styles.inlineAddText}>{addingCategory ? t("common.cancel") : `+ ${t("items.addCategory", { defaultValue: "Add category" })}`}</Text>
            </Pressable>
            {addingCategory ? (
              <View style={styles.inlineAddRow}>
                <TextInput style={[styles.input, styles.inlineAddInput]} value={newCategoryName} onChangeText={setNewCategoryName} placeholder={t("items.categoryName", { defaultValue: "Category name" })} placeholderTextColor={colors.textMuted} />
                <Pressable onPress={createCategory} disabled={!newCategoryName.trim()} style={[styles.inlineAddButton, !newCategoryName.trim() && styles.disabledButton]}><Text style={styles.inlineAddButtonText}>{t("common.create")}</Text></Pressable>
              </View>
            ) : null}

            <PickerField
              label={t("items.primaryUnit", { defaultValue: t("items.unit") })}
              placeholder={t("items.selectUnit")}
              value={primaryUnitId}
              options={units}
              getLabel={(unit) => `${unit.name} (${unit.code})`}
              onSelect={(unit) => setPrimaryUnitId(unit.id)}
              error={errors.primaryUnitId}
            />
            <Pressable onPress={() => setAddingUnit((value) => !value)} style={styles.inlineAddToggle} accessibilityRole="button">
              <Text style={styles.inlineAddText}>{addingUnit ? t("common.cancel") : `+ ${t("items.addUnit", { defaultValue: "Add unit" })}`}</Text>
            </Pressable>
            {addingUnit ? (
              <View style={styles.inlineAddRow}>
                <TextInput style={[styles.input, styles.inlineAddInput]} value={newUnitName} onChangeText={setNewUnitName} placeholder={t("items.unitName", { defaultValue: "Unit name" })} placeholderTextColor={colors.textMuted} />
                <TextInput style={[styles.input, styles.unitCodeInput]} value={newUnitCode} onChangeText={setNewUnitCode} placeholder={t("items.unitCode", { defaultValue: "Code" })} placeholderTextColor={colors.textMuted} />
                <Pressable onPress={createUnit} disabled={!newUnitName.trim() || !newUnitCode.trim()} style={[styles.inlineAddButton, (!newUnitName.trim() || !newUnitCode.trim()) && styles.disabledButton]}><Text style={styles.inlineAddButtonText}>{t("common.create")}</Text></Pressable>
              </View>
            ) : null}

            <View style={styles.secondaryHeader}>
              <Text style={styles.label}>{t("items.secondaryUnit", { defaultValue: "Secondary unit" })}</Text>
              <Text style={styles.optionalText}>{t("picker.optional", { defaultValue: "Optional" })}</Text>
            </View>
            <PickerField
              label=""
              placeholder={t("items.none", { defaultValue: "None" })}
              value={secondaryUnitId}
              options={units.filter((unit) => unit.id !== primaryUnitId)}
              getLabel={(unit) => `${unit.name} (${unit.code})`}
              onSelect={(unit) => setSecondaryUnitId(unit.id)}
            />
            {secondaryUnitId ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t("items.conversionFactor", { defaultValue: "Conversion factor" })}</Text>
                <TextInput style={[styles.input, errors.conversionFactor && styles.inputError]} keyboardType="numeric" value={conversionFactor} onChangeText={setConversionFactor} placeholder="1 primary = ? secondary" placeholderTextColor={colors.textMuted} />
                {errors.conversionFactor ? <Text style={styles.errorText}>{errors.conversionFactor}</Text> : null}
                <Text style={styles.fieldHint}>{t("items.conversionFactorHelp", { defaultValue: "How many secondary units equal one primary unit." })}</Text>
              </View>
            ) : null}

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t("items.salePrice")}</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={sellingPrice} onChangeText={setSellingPrice} />
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t("items.purchasePrice")}</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={purchasePrice} onChangeText={setPurchasePrice} />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("items.barcode")}</Text>
              <TextInput style={styles.input} value={barcodeValue} onChangeText={setBarcodeValue} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t("items.hsCode")}</Text>
              <TextInput style={styles.input} value={hsCode} onChangeText={setHsCode} />
            </View>
          </View>

          {!isEdit && warehouses.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t("items.openingStock")}</Text>
              <Text style={styles.sectionHint}>{t("items.openingStockHint")}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{t("items.openingStockRate")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder={String(purchasePrice || 0)}
                  placeholderTextColor={colors.textMuted}
                  value={openingStockRate}
                  onChangeText={setOpeningStockRate}
                />
              </View>

              {warehouses.map((warehouse) => (
                <View key={warehouse.id} style={styles.field}>
                  <Text style={styles.label}>{warehouse.name}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={openingStock[warehouse.id] ?? ""}
                    onChangeText={(value) => setOpeningStock((previous) => ({ ...previous, [warehouse.id]: value }))}
                  />
                </View>
              ))}

              {errors.openingStock ? <Text style={styles.errorText}>{errors.openingStock}</Text> : null}
            </View>
          ) : null}

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </ScrollView>

        <StickyActionBar
          primaryText={t("items.save")}
          onPrimary={handleSubmit}
          primaryLoading={submitting}
          onSecondary={() => router.back()}
          secondaryText={t("common.cancel")}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bodyBg },
  scrollContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: { marginBottom: 14 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: 4 },
  sectionHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginBottom: 14, lineHeight: 17 },
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  fieldHint: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 5 },
  optionalText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  secondaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  inlineAddToggle: { alignSelf: "flex-start", minHeight: 34, justifyContent: "center", paddingHorizontal: 2, marginTop: -8, marginBottom: 7 },
  inlineAddText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary },
  inlineAddRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  inlineAddInput: { flex: 1, marginBottom: 0 },
  unitCodeInput: { width: 70, marginBottom: 0 },
  inlineAddButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  inlineAddButtonText: { fontFamily: fonts.semiBold, fontSize: 12, color: "#fff" },
  disabledButton: { opacity: 0.45 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.cardBg,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  row: { flexDirection: "row", gap: 10 },
  rowField: { flex: 1, marginBottom: 14 },
  formError: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255,103,87,0.08)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});

