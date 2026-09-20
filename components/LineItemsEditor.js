import { useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import PickerField from "./PickerField";
import BottomSheet from "./ui/BottomSheet";
import Button, { IconButton } from "./ui/Button";
import FormField from "./ui/FormField";
import DiscountField from "./ui/DiscountField";
import { EmptyState } from "./ui/ListStates";
import { formatNpr } from "../lib/format";
import { unitLabel } from "../lib/labels";
import { estimateLine, isNonNegativeNumber, isPositiveNumber, isPercent, toNumber } from "../lib/documentTotals";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import BarcodeCameraModal from "./BarcodeCameraModal";

/**
 * Shared between Create Sale / Create Purchase / Credit & Debit Notes —
 * salesInvoiceLineInputSchema, purchaseBillLineInputSchema,
 * creditNoteLineInputSchema and debitNoteLineInputSchema are identically
 * shaped: itemId, unitId, quantity, rate, discType, discValue (+ variantId,
 * intentionally not exposed — a per-variant picker is its own sub-feature;
 * lines post with variantId omitted, same as any non-variant item on desktop).
 *
 * Presentation: the form shows one compact card per line (tap to edit,
 * trash to remove); editing happens in a bottom sheet with the item picker,
 * unit picker, qty, rate, and discount — never an inline wall of inputs.
 *
 * `priceField` ("sellingPrice" | "purchasePrice") picks which item price a
 * new line's rate defaults from — Sale/Credit Note pass "sellingPrice",
 * Purchase/Debit Note pass "purchasePrice" (the MOBILE-UPGRADE-LOG.md §0
 * bug: it used to be hardcoded to sellingPrice).
 *
 * Units: an item offers exactly the units it genuinely has — primary, plus
 * secondary when configured (GET /api/items returns primaryUnitId/Name/Code
 * and secondaryUnitId/Name/Code + conversionFactor). Rate per unit follows
 * desktop's resolveItemRateForUnit / convertRateBetweenUnits in
 * document-form.tsx: the item price is entered for the PRIMARY unit, and a
 * secondary-unit rate is price ÷ conversionFactor (5 dp, like desktop).
 * Desktop additionally applies party-group price overrides — mobile's item
 * list doesn't carry those, so the base item price is used; the server
 * never trusts this rate for anything but what the user typed anyway.
 * `units` (from GET /api/mobile/units) is only a fallback catalog for an
 * item the API returned without unit info.
 *
 * Line values are kept as strings while editing (what TextInput wants);
 * screens Number() them when building the POST payload.
 */
export const EMPTY_LINE = { itemId: null, unitId: null, quantity: "1", rate: "0", discType: "percent", discValue: "0" };

export function normalizeLine(raw) {
  return {
    itemId: raw?.itemId ? Number(raw.itemId) : null,
    unitId: raw?.unitId ? Number(raw.unitId) : null,
    quantity: raw?.quantity != null && raw.quantity !== "" ? String(raw.quantity) : "1",
    rate: raw?.rate != null && raw.rate !== "" ? String(raw.rate) : "0",
    discType: raw?.discType === "amount" ? "amount" : "percent",
    discValue: raw?.discValue != null && raw.discValue !== "" ? String(raw.discValue) : "0",
  };
}

export function unitOptionsForItem(item, unitsCatalog = []) {
  if (!item) return [];
  const options = [];
  if (item.primaryUnitId) {
    options.push({ id: item.primaryUnitId, name: item.primaryUnitName ?? item.primaryUnitCode ?? String(item.primaryUnitId), code: item.primaryUnitCode ?? null });
  }
  if (item.secondaryUnitId) {
    options.push({ id: item.secondaryUnitId, name: item.secondaryUnitName ?? item.secondaryUnitCode ?? String(item.secondaryUnitId), code: item.secondaryUnitCode ?? null });
  }
  if (options.length === 0 && Array.isArray(unitsCatalog) && unitsCatalog.length > 0) return unitsCatalog;
  return options;
}

function baseRate(item, priceField) {
  return toNumber(item?.[priceField]);
}

/** Port of desktop's resolveItemRateForUnit (minus party-group prices). */
export function rateForUnit(item, unitId, priceField) {
  const base = baseRate(item, priceField);
  const factor = toNumber(item?.conversionFactor);
  if (unitId && item?.secondaryUnitId && unitId === item.secondaryUnitId && factor > 0) {
    return Number((base / factor).toFixed(5));
  }
  return base;
}

/** Port of desktop's convertRateBetweenUnits. */
export function convertRateBetweenUnits(item, currentRate, fromUnitId, toUnitId, priceField) {
  if (!toUnitId) return 0;
  const fallback = rateForUnit(item, toUnitId, priceField);
  const rate = toNumber(currentRate) || rateForUnit(item, fromUnitId, priceField);
  const factor = toNumber(item?.conversionFactor);
  if (!fromUnitId || !factor || fromUnitId === toUnitId) return Number((rate || fallback).toFixed(5));
  if (fromUnitId === item.primaryUnitId && toUnitId === item.secondaryUnitId) return Number((rate / factor).toFixed(5));
  if (fromUnitId === item.secondaryUnitId && toUnitId === item.primaryUnitId) return Number((rate * factor).toFixed(5));
  return Number((rate || fallback).toFixed(5));
}

function validateLine(t, line) {
  const errors = {};
  if (!line.itemId) errors.itemId = t("lineItems.itemRequired");
  if (!line.unitId) errors.unitId = t("lineItems.unitRequired");
  if (!isPositiveNumber(line.quantity)) errors.quantity = t("lineItems.quantityRequired");
  if (!isNonNegativeNumber(line.rate) || line.rate === "") errors.rate = t("lineItems.rateInvalid");
  if (!isNonNegativeNumber(line.discValue)) errors.discValue = t("lineItems.discountInvalid");
  else if (line.discType === "percent" && !isPercent(line.discValue)) errors.discValue = t("forms.percentRange");
  return errors;
}

export default function LineItemsEditor({ lines = [], items = [], units = [], onChange, priceField = "sellingPrice", error, warning, title }) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState(null); // { index: number | null, line, errors }
  const [scannerOpen, setScannerOpen] = useState(false);
  const scrollRef = useRef(null);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const priceLabelKey = priceField === "purchasePrice" ? "items.purchasePrice" : "items.salePrice";

  function handleItemScanned(item) {
    if (!item) return;
    const existingIndex = lines.findIndex((l) => Number(l.itemId) === Number(item.id));
    if (existingIndex >= 0) {
      const updatedLines = lines.map((line, idx) => {
        if (idx === existingIndex) {
          const currentQty = toNumber(line.quantity) || 0;
          return {
            ...line,
            quantity: String(currentQty + 1),
          };
        }
        return line;
      });
      onChange(updatedLines);
    } else {
      const unitId = item.primaryUnitId ?? unitOptionsForItem(item, units)[0]?.id ?? null;
      const rate = String(item[priceField] || 0);
      const newLine = {
        itemId: item.id,
        unitId,
        quantity: "1",
        rate,
        discType: "percent",
        discValue: "0",
      };
      onChange([...lines, newLine]);
    }
  }

  function openNew() {
    setEditor({ index: null, line: { ...EMPTY_LINE }, errors: {} });
  }

  function openExisting(index) {
    setEditor({ index, line: normalizeLine(lines[index]), errors: {} });
  }

  function removeLine(index) {
    onChange(lines.filter((_, i) => i !== index));
  }

  function patchEditor(patch) {
    setEditor((current) => (current ? { ...current, line: { ...current.line, ...patch }, errors: {} } : current));
  }

  function selectItem(item) {
    const unitId = item.primaryUnitId ?? unitOptionsForItem(item, units)[0]?.id ?? null;
    patchEditor({ itemId: item.id, unitId, rate: String(rateForUnit(item, unitId, priceField)) });
  }

  function selectUnit(unit) {
    const item = itemsById.get(editor?.line.itemId);
    if (!item) return patchEditor({ unitId: unit.id });
    const rate = convertRateBetweenUnits(item, editor.line.rate, editor.line.unitId, unit.id, priceField);
    patchEditor({ unitId: unit.id, rate: String(rate) });
  }

  function commitEditor() {
    if (!editor) return;
    const errors = validateLine(t, editor.line);
    if (Object.keys(errors).length > 0) {
      setEditor({ ...editor, errors });
      return;
    }
    const next = lines.slice();
    if (editor.index == null) next.push(editor.line);
    else next[editor.index] = editor.line;
    onChange(next);
    setEditor(null);
  }

  const editingItem = editor ? itemsById.get(editor.line.itemId) : null;
  const editingUnits = editor ? unitOptionsForItem(editingItem, units) : [];
  const editingEstimate = editor ? estimateLine(editor.line) : null;
  const editingIsSecondaryUnit = Boolean(editingItem?.secondaryUnitId && editor?.line.unitId === editingItem.secondaryUnitId && toNumber(editingItem.conversionFactor) > 0);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {title ?? t("lineItems.title")}
          {lines.length > 0 ? <Text style={styles.count}> ({lines.length})</Text> : null}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setScannerOpen(true)}
            style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
            accessibilityRole="button"
          >
            <Feather name="camera" size={14} color={colors.primary} />
            <Text style={styles.scanButtonText}>{t("lineItems.scanBarcode", { defaultValue: "Scan Barcode" })}</Text>
          </Pressable>
          <Pressable onPress={openNew} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]} accessibilityRole="button">
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={styles.addButtonText}>{t("lineItems.addLine")}</Text>
          </Pressable>
        </View>
      </View>

      {lines.length === 0 ? (
        <View style={[styles.emptyWrap, error && styles.emptyWrapError, warning && !error && styles.emptyWrapWarning]}>
          <EmptyState compact icon="shopping-bag" title={t("lineItems.empty")} body={t("lineItems.emptyHint")} actionLabel={t("lineItems.addLine")} onAction={openNew} />
        </View>
      ) : (
        lines.map((line, index) => {
          const item = itemsById.get(line.itemId);
          const unit = unitOptionsForItem(item, units).find((option) => option.id === line.unitId);
          const estimate = estimateLine(line);
          const discountText =
            toNumber(line.discValue) > 0 ? (line.discType === "percent" ? `−${toNumber(line.discValue)}${t("sale.discountPercent")}` : `−${formatNpr(line.discValue)}`) : null;
          return (
            <Pressable
              key={index}
              onPress={() => openExisting(index)}
              style={({ pressed }) => [styles.lineCard, pressed && styles.lineCardPressed]}
              accessibilityRole="button"
              accessibilityLabel={item?.name ?? t("lineItems.selectItem")}
            >
              <View style={styles.lineMain}>
                <Text style={[styles.lineName, !item && styles.lineNameMissing]} numberOfLines={1}>
                  {item?.name ?? t("lineItems.selectItem")}
                </Text>
                <Text style={styles.lineMeta} numberOfLines={1}>
                  {toNumber(line.quantity)} {unitLabel(unit)} × {formatNpr(line.rate)}
                  {discountText ? `  ·  ${discountText}` : ""}
                </Text>
              </View>
              <Text style={styles.lineAmount}>{formatNpr(estimate.amount)}</Text>
              <IconButton icon="trash-2" color={colors.danger} onPress={() => removeLine(index)} accessibilityLabel={t("lineItems.remove")} style={styles.removeButton} />
            </Pressable>
          );
        })
      )}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : warning ? (
        <View style={styles.helperRow}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      <BottomSheet
        visible={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.index == null ? t("lineItems.addLine") : t("lineItems.editLine")}
        maxHeightRatio={0.9}
        footer={
          <View style={styles.footerRow}>
            <Button label={t("common.cancel")} variant="secondary" onPress={() => setEditor(null)} style={styles.footerSecondary} />
            <Button label={t("lineItems.done")} onPress={commitEditor} style={styles.footerPrimary} />
          </View>
        }
      >
        {editor ? (
          <ScrollView
            ref={scrollRef}
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <PickerField
              label={t("lineItems.product")}
              placeholder={t("lineItems.selectItem")}
              required
              value={editor.line.itemId}
              options={items}
              getSubtitle={(item) => `${t(priceLabelKey)}: ${formatNpr(item?.[priceField])}`}
              onSelect={selectItem}
              error={editor.errors.itemId}
            />
            <View style={styles.twoCol}>
              <FormField
                label={t("lineItems.qty")}
                required
                value={String(editor.line.quantity ?? "")}
                onChangeText={(value) => patchEditor({ quantity: value })}
                keyboardType="decimal-pad"
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollTo({ y: 40, animated: true }), 100);
                }}
                error={editor.errors.quantity}
                style={styles.col}
              />
              <PickerField
                label={t("lineItems.unit")}
                placeholder={t("lineItems.selectUnit")}
                required
                value={editor.line.unitId}
                options={editingUnits}
                getLabel={(unit) => (unit.code && unit.name && unit.code !== unit.name ? `${unit.name} (${unit.code})` : unit.name || unit.code || "")}
                onSelect={selectUnit}
                disabled={!editor.line.itemId}
                error={editor.errors.unitId}
                style={styles.col}
              />
            </View>
            <FormField
              label={t("lineItems.rate")}
              required
              value={String(editor.line.rate ?? "")}
              onChangeText={(value) => patchEditor({ rate: value })}
              keyboardType="decimal-pad"
              prefix={t("sale.discountAmount")}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollTo({ y: 150, animated: true }), 100);
              }}
              error={editor.errors.rate}
              hint={editingIsSecondaryUnit ? t("lineItems.secondaryUnitRateHint", { factor: toNumber(editingItem.conversionFactor) }) : undefined}
            />
            <DiscountField
              label={t("lineItems.discount")}
              value={String(editor.line.discValue ?? "")}
              type={editor.line.discType}
              onChangeValue={(value) => patchEditor({ discValue: value })}
              onChangeType={(type) => patchEditor({ discType: type })}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
              }}
              error={editor.errors.discValue}
            />
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>{t("lineItems.lineTotal")}</Text>
              <Text style={styles.estimateValue}>{formatNpr(editingEstimate?.amount ?? 0)}</Text>
            </View>
            <Text style={styles.estimateNote}>{t("forms.estimateNote")}</Text>
          </ScrollView>
        ) : null}
      </BottomSheet>

      <BarcodeCameraModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        items={items}
        onItemScanned={handleItemScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  count: { color: colors.textMuted, fontFamily: fonts.medium },
  scanButton: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 10, borderRadius: 8 },
  scanButtonPressed: { backgroundColor: "rgba(152,95,253,0.08)" },
  scanButtonText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 10, borderRadius: 8 },
  addButtonPressed: { backgroundColor: "rgba(152,95,253,0.08)" },
  addButtonText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  emptyWrap: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 12, marginBottom: 12 },
  emptyWrapError: { borderColor: colors.danger },
  emptyWrapWarning: { borderColor: colors.warning, backgroundColor: "rgba(253,175,34,0.06)" },
  lineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bodyBg,
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 2,
    paddingVertical: 8,
    marginBottom: 8,
    minHeight: 56,
  },
  lineCardPressed: { backgroundColor: "rgba(152,95,253,0.08)" },
  lineMain: { flex: 1 },
  lineName: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  lineNameMissing: { color: colors.danger },
  lineMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lineAmount: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  removeButton: { width: 40 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 2, marginBottom: 8 },
  helperRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, marginBottom: 8 },
  warningText: { color: "#B47300", fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  sheetScroll: { flexGrow: 1, flexShrink: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  estimateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  estimateLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  estimateValue: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.primary },
  estimateNote: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  footerRow: { flexDirection: "row", gap: 10 },
  footerSecondary: { flex: 1 },
  footerPrimary: { flex: 2 },
});
