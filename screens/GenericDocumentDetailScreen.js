import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import StatusBadge from "../components/ui/StatusBadge";
import MoneySummary from "../components/ui/MoneySummary";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function GenericDocumentDetailScreen({
  title,
  endpointPrefix,
  editRoutePrefix,
  numberKey,
  dateKey,
  partyKey = "partyName",
  hasPricing = true,
}) {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    apiFetch(`${endpointPrefix}/${id}`)
      .then((result) => {
        if (token !== requestToken.current) return;
        setData(result ?? null);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [endpointPrefix, id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const doc = data?.order || data?.quotation || data?.challan || data?.transfer || data?.item || data;
  const lines = Array.isArray(data?.lines) ? data.lines : Array.isArray(doc?.lines) ? doc.lines : [];

  const docNumber = doc ? (numberKey ? doc[numberKey] : null) || doc?.orderNumber || doc?.quotationNumber || doc?.challanNumber || doc?.transferNumber || `#${id}` : "";
  const docDate = doc ? (dateKey ? doc[dateKey] : null) || doc?.orderDate || doc?.quotationDate || doc?.challanDate || doc?.transferDate || doc?.date : "";
  const docParty = doc ? doc[partyKey] || doc?.partyName || doc?.supplierName || doc?.customerName || doc?.fromWarehouseName : "";

  const summaryRows = [];
  if (doc && hasPricing) {
    if (doc.subtotal != null) summaryRows.push({ label: t("sale.subtotal", { defaultValue: "Subtotal" }), value: doc.subtotal });
    if (Number(doc.discAmount || 0) > 0) {
      summaryRows.push({
        label: `${t("sale.discount", { defaultValue: "Discount" })}${doc.discPercent ? ` (${doc.discPercent}%)` : ""}`,
        value: doc.discAmount,
      });
    }
    if (Number(doc.vatAmount || 0) > 0) {
      summaryRows.push({
        label: `${t("sale.vat", { defaultValue: "VAT" })}${doc.vatPercent ? ` (${doc.vatPercent}%)` : ""}`,
        value: doc.vatAmount,
      });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScreenHeader
        title={title || docNumber}
        right={
          doc && editRoutePrefix ? (
            <TouchableOpacity
              onPress={() => router.push(`${editRoutePrefix}/${id}`)}
              hitSlop={8}
              style={styles.editButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.edit", { defaultValue: "Edit" })}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonList rows={6} />
        </View>
      ) : error || !doc ? (
        <ErrorState message={error ?? t("common.somethingWentWrong")} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.docNumber}>{docNumber}</Text>
              {doc.status ? <StatusBadge status={doc.status} /> : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("common.date", { defaultValue: "Date" })}:</Text>
              <Text style={styles.metaValue}>{docDate ? String(docDate).slice(0, 10) : "-"}</Text>
            </View>
            {docParty ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("sale.party", { defaultValue: "Party" })}:</Text>
                <Text style={styles.metaValue}>{docParty}</Text>
              </View>
            ) : null}
            {doc.warehouseName ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("forms.warehouse", { defaultValue: "Warehouse" })}:</Text>
                <Text style={styles.metaValue}>{doc.warehouseName}</Text>
              </View>
            ) : null}
            {doc.toWarehouseName ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("inventory.toWarehouse", { defaultValue: "To Warehouse" })}:</Text>
                <Text style={styles.metaValue}>{doc.toWarehouseName}</Text>
              </View>
            ) : null}
            {doc.expectedDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("forms.expectedDate", { defaultValue: "Expected Date" })}:</Text>
                <Text style={styles.metaValue}>{String(doc.expectedDate).slice(0, 10)}</Text>
              </View>
            ) : null}
            {doc.expiryDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("forms.expiryDate", { defaultValue: "Expiry Date" })}:</Text>
                <Text style={styles.metaValue}>{String(doc.expiryDate).slice(0, 10)}</Text>
              </View>
            ) : null}
          </View>

          {lines.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t("sale.items", { defaultValue: "Items" })} ({lines.length})</Text>
              {lines.map((line, index) => (
                <View key={line.id ?? index} style={[styles.lineItemRow, index > 0 && styles.lineDivider]}>
                  <View style={styles.lineMain}>
                    <Text style={styles.lineName}>{line.itemName || `#${line.itemId}`}</Text>
                    <Text style={styles.lineMeta}>
                      {line.quantity} {line.unitCode || line.unitName || ""} {hasPricing && line.rate != null ? `× ${formatNpr(line.rate)}` : ""}
                    </Text>
                  </View>
                  {hasPricing && line.lineTotal != null ? <Text style={styles.lineTotal}>{formatNpr(line.lineTotal)}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {hasPricing && summaryRows.length > 0 ? (
            <View style={styles.card}>
              <MoneySummary
                rows={summaryRows}
                totalLabel={t("sale.total", { defaultValue: "Total" })}
                totalValue={doc.totalAmount}
              />
            </View>
          ) : null}

          {doc.notes || doc.note ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t("forms.notes", { defaultValue: "Notes" })}</Text>
              <Text style={styles.notesText}>{doc.notes || doc.note}</Text>
            </View>
          ) : null}
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  docNumber: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  metaLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  metaValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, flex: 1, textAlign: "right" },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: 10 },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  lineDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  lineMain: { flex: 1, marginRight: 12 },
  lineName: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  lineMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lineTotal: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.primary },
  notesText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bodyBg,
    alignItems: "center",
    justifyContent: "center",
  },
});