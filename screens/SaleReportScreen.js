import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr, formatNumber, countsTowardTotals } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function SaleReportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("thisMonth");
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      apiFetch("/api/mobile/sales-invoices")
        .then((data) => {
          if (token !== requestToken.current) return;
          setInvoices(Array.isArray(data) ? data : []);
          setError(null);
        })
        .catch((err) => {
          if (token !== requestToken.current) return;
          setError(err.messageKey ? t(err.messageKey) : err.message);
        })
        .finally(() => {
          if (token !== requestToken.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [t],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonthStr = monthNames[now.getMonth()];
  const currentYearStr = now.getFullYear();
  const startDateStr = `01/${String(now.getMonth() + 1).padStart(2, "0")}/${currentYearStr}`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endDateStr = `${lastDay}/${String(now.getMonth() + 1).padStart(2, "0")}/${currentYearStr}`;

  const filtered = useMemo(() => {
    const live = invoices.filter(countsTowardTotals);
    if (range === "allTime") return live;
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return live.filter((inv) => {
      const date = typeof inv.invoiceDate === "string" ? inv.invoiceDate : "";
      return date.startsWith(currentMonthPrefix);
    });
  }, [invoices, range]);

  const totalSale = filtered.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
  const balanceDue = filtered.reduce((sum, inv) => sum + Number(inv.dueAmount ?? 0), 0);

  function exportPdf() {
    Alert.alert("PDF Export", "Preparing sale report PDF export...");
  }

  function exportXls() {
    Alert.alert("Excel Export", "Preparing sale report Excel export...");
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("sale.reportTitle", "Sale Report")}
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.pdfBadge} onPress={exportPdf} activeOpacity={0.8}>
              <Text style={styles.badgeText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.xlsBadge} onPress={exportXls} activeOpacity={0.8}>
              <Text style={styles.badgeText}>XLS</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Date Range Selector Bar */}
      <View style={styles.dateRangeBar}>
        <TouchableOpacity
          style={styles.dropdownToggle}
          onPress={() => setRange((prev) => (prev === "thisMonth" ? "allTime" : "thisMonth"))}
        >
          <Text style={styles.dropdownText}>
            {range === "thisMonth" ? t("sale.thisMonth", "This Month") : t("sale.allTime", "All Time")}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.dateRangeDivider} />

        <View style={styles.dateRangeDates}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={styles.dateRangeText}>
            {range === "thisMonth" ? `${startDateStr} - ${endDateStr}` : "All Recorded Dates"}
          </Text>
        </View>
      </View>

      {/* 3 Stats Cards Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBadge, { backgroundColor: tint("primary", 0.1) }]}>
            <MaterialCommunityIcons name="receipt-text-outline" size={16} color={colors.primary} />
          </View>
          <Text style={styles.statLabel}>{t("sale.noOfTxns", "Txns")}</Text>
          <Text style={styles.statValue}>{formatNumber(filtered.length)}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconBadge, { backgroundColor: "#ECFDF5" }]}>
            <MaterialCommunityIcons name="point-of-sale" size={16} color="#059669" />
          </View>
          <Text style={styles.statLabel}>{t("sale.totalSale", "Total Sale")}</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {formatNpr(totalSale)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconBadge, { backgroundColor: balanceDue > 0 ? "#FEF2F2" : "#ECFDF5" }]}>
            <MaterialCommunityIcons
              name={balanceDue > 0 ? "alert-circle-outline" : "check-circle-outline"}
              size={16}
              color={balanceDue > 0 ? "#DC2626" : "#059669"}
            />
          </View>
          <Text style={styles.statLabel}>{t("sale.balanceDue", "Due")}</Text>
          <Text
            style={[styles.statValue, { color: balanceDue > 0 ? colors.danger : colors.success }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatNpr(balanceDue)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(inv) => String(inv.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bar-chart-2"
              title={t("sale.noSalesTitle", "No sales found")}
              body={t("sale.noSalesBody", "No transactions recorded for the selected period.")}
            />
          }
          renderItem={({ item }) => {
            const isDue = Number(item.dueAmount ?? 0) > 0;
            return (
              <TouchableOpacity
                style={styles.reportRowCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/sales/${item.id}`)}
              >
                <View style={styles.reportRowHeader}>
                  <View style={styles.squircleMini}>
                    <MaterialCommunityIcons name="point-of-sale" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.headerInfoCol}>
                    <Text style={styles.partyName} numberOfLines={1}>
                      {item.partyName || "Cash Sale"}
                    </Text>
                    <Text style={styles.saleTag}>#{formatNumber(item.invoiceNumber)} · {item.invoiceDate}</Text>
                  </View>
                  <View style={[styles.dueBadge, { backgroundColor: isDue ? "#FEF2F2" : "#ECFDF5" }]}>
                    <Text style={[styles.dueBadgeText, { color: isDue ? "#DC2626" : "#059669" }]}>
                      {isDue ? formatNpr(item.dueAmount) : "Paid"}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportRowBottom}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Total</Text>
                    <Text style={styles.amountValue}>{formatNpr(item.totalAmount)}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Received</Text>
                    <Text style={[styles.amountValue, { color: colors.success }]}>
                      {formatNpr(Number(item.totalAmount ?? 0) - Number(item.dueAmount ?? 0))}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pdfBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  xlsBadge: {
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#FFFFFF",
  },

  dateRangeBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dropdownText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  dateRangeDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  dateRangeDates: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  dateRangeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },

  filtersSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filtersLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  filtersScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterFunnelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterFunnelText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },
  filterChip: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },

  listContent: {
    paddingHorizontal: 16,
  },
  reportRowCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  reportRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  squircleMini: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tint("primary", 0.1),
    borderWidth: 1,
    borderColor: tint("primary", 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfoCol: {
    flex: 1,
  },
  partyName: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  saleTag: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  dueBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  reportRowBottom: {
    flexDirection: "row",
    gap: 32,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  amountCol: {
    gap: 2,
  },
  amountLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  amountValue: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
});
