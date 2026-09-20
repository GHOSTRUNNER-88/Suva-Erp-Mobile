import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr, formatNumber } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Real data via GET /api/mobile/items/[id] — item info, price(s),
 * category/unit, and a real per-warehouse stock breakdown.
 */
export default function ItemDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/mobile/items/${id}`)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  useEffect(() => load(), [load]);

  const selling = Number(item?.sellingPrice ?? 0);
  const purchase = Number(item?.purchasePrice ?? 0);
  const margin = selling > purchase && purchase > 0 ? (((selling - purchase) / purchase) * 100).toFixed(0) : null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScreenHeader
        title={item?.name ?? t("items.detailTitle")}
        right={
          item ? (
            <TouchableOpacity
              onPress={() => router.push(`/items/edit/${id}`)}
              hitSlop={8}
              style={styles.editButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.edit", { defaultValue: "Edit" })}
            >
              <Feather name="edit-2" size={17} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonList rows={5} />
        </View>
      ) : error || !item ? (
        <ErrorState message={error ?? t("items.notFound")} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <View style={styles.card}>
            <View style={styles.headerTopRow}>
              <View style={styles.itemIconSquircle}>
                <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.primary} />
              </View>
              <View style={styles.itemHeaderCol}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.categoryName ? (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.categoryName}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.metaList}>
              {item.barcodeValue ? (
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelRow}>
                    <Feather name="maximize" size={13} color={colors.textMuted} />
                    <Text style={styles.metaLabel}>{t("items.barcode")}</Text>
                  </View>
                  <Text style={styles.metaValue}>{item.barcodeValue}</Text>
                </View>
              ) : null}
              {item.hsCode ? (
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelRow}>
                    <Feather name="hash" size={13} color={colors.textMuted} />
                    <Text style={styles.metaLabel}>{t("items.hsCode")}</Text>
                  </View>
                  <Text style={styles.metaValue}>{item.hsCode}</Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <View style={styles.metaLabelRow}>
                  <Feather name="box" size={13} color={colors.textMuted} />
                  <Text style={styles.metaLabel}>{t("items.unit")}</Text>
                </View>
                <Text style={styles.metaValue}>
                  {item.primaryUnitName ?? "—"} {item.primaryUnitCode ? `(${item.primaryUnitCode})` : ""}
                  {item.secondaryUnitName ? ` / ${item.secondaryUnitName} (${item.secondaryUnitCode})` : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* Pricing Section Cards */}
          <View style={styles.pricingGrid}>
            <View style={[styles.priceCard, { backgroundColor: tint("primary", 0.05), borderColor: tint("primary", 0.2) }]}>
              <Text style={styles.priceLabel}>{t("items.salePrice")}</Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>{formatNpr(item.sellingPrice)}</Text>
              {margin ? (
                <View style={styles.marginPill}>
                  <Feather name="trending-up" size={11} color="#059669" />
                  <Text style={styles.marginText}>+{margin}% margin</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>{t("items.purchasePrice")}</Text>
              <Text style={styles.priceValue}>{formatNpr(item.purchasePrice)}</Text>
              <Text style={styles.priceSubtext}>{t("items.costPerUnit", "Cost per unit")}</Text>
            </View>
          </View>

          {/* Stock Section Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconWrap}>
                <MaterialCommunityIcons name="warehouse" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{t("items.stockSection")}</Text>
              {item.lowStock === true ? (
                <View style={[styles.badge, styles.lowStockBadge]}>
                  <Feather name="alert-triangle" size={11} color={colors.danger} />
                  <Text style={[styles.badgeText, styles.lowStockBadgeText]}>{t("items.lowStock")}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.totalStockBox}>
              <Text style={styles.totalStockLabel}>{t("items.totalStock")}</Text>
              <Text style={styles.totalStockValue}>
                {formatNumber(item.totalStock)} {item.primaryUnitCode ?? ""}
              </Text>
              {item.reorderLevel !== null ? (
                <Text style={styles.reorderText}>
                  {t("items.reorderLevel")}: {formatNumber(item.reorderLevel)} {item.primaryUnitCode ?? ""}
                </Text>
              ) : null}
            </View>

            {Array.isArray(item.warehouseStock) && item.warehouseStock.length > 0 ? (
              <>
                <Text style={styles.subsectionTitle}>{t("items.byWarehouse")}</Text>
                {item.warehouseStock.map((row) => (
                  <View key={row.warehouseId} style={styles.warehouseRow}>
                    <View style={styles.warehouseInfoRow}>
                      <MaterialCommunityIcons name="store-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.warehouseName}>{row.warehouseName}</Text>
                    </View>
                    <View style={styles.warehouseQtyBadge}>
                      <Text style={styles.warehouseQtyText}>
                        {formatNumber(row.quantity)} {item.primaryUnitCode ?? ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  itemIconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: tint("primary", 0.1),
    borderWidth: 1,
    borderColor: tint("primary", 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  itemHeaderCol: { flex: 1 },
  itemName: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.light,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },

  metaList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 10,
    gap: 8,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  metaValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },

  pricingGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  priceCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  priceLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  priceValue: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.text,
  },
  priceSubtext: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  marginPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  marginText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#059669",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: tint("primary", 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, flex: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 11 },
  lowStockBadge: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECDD3" },
  lowStockBadgeText: { color: colors.danger },

  totalStockBox: {
    backgroundColor: colors.bodyBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalStockLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textTransform: "uppercase", marginBottom: 2 },
  totalStockValue: { fontFamily: fonts.semiBold, fontSize: 24, color: colors.text },
  reorderText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  subsectionTitle: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  warehouseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  warehouseInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  warehouseName: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  warehouseQtyBadge: {
    backgroundColor: colors.light,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warehouseQtyText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },

  editButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
});
