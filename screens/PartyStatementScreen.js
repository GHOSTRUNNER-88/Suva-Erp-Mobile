import { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const DOCUMENT_ROUTES = {
  salesInvoice: (id) => `/sales/${id}`,
  purchaseBill: (id) => `/purchases/${id}`,
  creditNote: (id) => `/credit-notes/${id}`,
  debitNote: (id) => `/debit-notes/${id}`,
  salesOrder: (id) => `/sales-orders/${id}`,
  purchaseOrder: (id) => `/purchase-orders/${id}`,
};

function localIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthBounds(monthsAgo) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return { from: localIso(start), to: localIso(end) };
}

export default function PartyStatementScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datePreset, setDatePreset] = useState("all");

  const range = useMemo(() => {
    if (datePreset === "thisMonth") return monthBounds(0);
    if (datePreset === "lastMonth") return monthBounds(1);
    return null;
  }, [datePreset]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (range) {
      params.set("from", range.from);
      params.set("to", range.to);
    }

    const query = params.toString();
    const url = `/api/mobile/parties/${id}/statement${query ? `?${query}` : ""}`;

    apiFetch(url)
      .then((res) => {
        if (cancelled) return;
        const resultData = res?.data || res;
        setData(resultData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || t("parties.statementLoadFailed", { defaultValue: "Failed to load statement" }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, range, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const party = data?.party;
  const periodTotals = data?.periodTotals;
  const entries = data?.entries ?? [];

  function formatSigned(amount) {
    const n = Number(amount ?? 0);
    return `${formatNpr(Math.abs(n))} ${n < 0 ? t("parties.cr", { defaultValue: "Cr" }) : t("parties.dr", { defaultValue: "Dr" })}`;
  }

  function onRowPress(entry) {
    if (!entry.sourceId) return;
    const routeFn = DOCUMENT_ROUTES[entry.label];
    if (routeFn) router.push(routeFn(entry.sourceId));
  }

  function Header() {
    return (
      <View style={styles.headerContainer}>
        {party && (
          <View style={styles.partyCard}>
            <View style={styles.partyMainRow}>
              <View style={styles.partyInfo}>
                <Text style={styles.partyName}>{party.name}</Text>
                {party.groupName && <Text style={styles.partyGroup}>{party.groupName}</Text>}
              </View>
              {party.panNumber && (
                <View style={styles.panBadge}>
                  <Text style={styles.panText}>PAN: {party.panNumber}</Text>
                </View>
              )}
            </View>
            {party.phoneNumber && (
              <View style={styles.phoneRow}>
                <Feather name="phone" size={12} color={colors.textMuted} />
                <Text style={styles.phoneText}>{party.phoneNumber}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.presetRow}>
          {[
            { id: "all", label: t("parties.allTime", { defaultValue: "All Time" }) },
            { id: "thisMonth", label: t("parties.thisMonth", { defaultValue: "This Month" }) },
            { id: "lastMonth", label: t("parties.lastMonth", { defaultValue: "Last Month" }) },
          ].map((preset) => (
            <TouchableOpacity
              key={preset.id}
              style={[styles.presetChip, datePreset === preset.id && styles.presetChipActive]}
              onPress={() => setDatePreset(preset.id)}
            >
              <Text style={[styles.presetText, datePreset === preset.id && styles.presetTextActive]}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {periodTotals && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{t("parties.openingBalance", { defaultValue: "Opening" })}</Text>
                <Text style={styles.summaryValue}>{formatSigned(periodTotals.openingBalance)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{t("parties.totalDebit", { defaultValue: "Total Dr" })}</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatNpr(periodTotals.totalDebit)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{t("parties.totalCredit", { defaultValue: "Total Cr" })}</Text>
                <Text style={[styles.summaryValue, { color: colors.success || "#10b981" }]}>{formatNpr(periodTotals.totalCredit)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{t("parties.closingBalance", { defaultValue: "Closing" })}</Text>
                <Text style={[styles.summaryValue, { fontFamily: fonts.bold }]}>{formatSigned(periodTotals.closingBalance)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.colDate]}>{t("common.date", { defaultValue: "Date" })}</Text>
          <Text style={[styles.thText, styles.colDesc]}>{t("common.description", { defaultValue: "Particulars" })}</Text>
          <Text style={[styles.thText, styles.colAmount]}>{t("parties.dr", { defaultValue: "Dr" })}</Text>
          <Text style={[styles.thText, styles.colAmount]}>{t("parties.cr", { defaultValue: "Cr" })}</Text>
          <Text style={[styles.thText, styles.colBalance]}>{t("parties.balance", { defaultValue: "Balance" })}</Text>
        </View>
      </View>
    );
  }

  function renderItem({ item }) {
    const isClickable = item.sourceId != null && !!DOCUMENT_ROUTES[item.label];
    const isDr = item.debit > 0;
    const isCr = item.credit > 0;

    return (
      <TouchableOpacity
        style={[styles.row, isClickable && styles.rowClickable]}
        onPress={() => onRowPress(item)}
        disabled={!isClickable}
        activeOpacity={0.7}
      >
        <Text style={[styles.cellText, styles.colDate]}>{item.date ? String(item.date).slice(0, 10) : ""}</Text>
        <View style={styles.colDesc}>
          <Text style={styles.descTitle} numberOfLines={1}>
            {item.reference ? `${item.label}: ${item.reference}` : item.label}
          </Text>
          {item.precedesOpeningDate && (
            <Text style={styles.precedesText}>{t("parties.precedesOpening", { defaultValue: "Prior" })}</Text>
          )}
        </View>
        <Text style={[styles.cellText, styles.colAmount, isDr && styles.drAmount]}>
          {isDr ? formatNpr(item.debit) : "-"}
        </Text>
        <Text style={[styles.cellText, styles.colAmount, isCr && styles.crAmount]}>
          {isCr ? formatNpr(item.credit) : "-"}
        </Text>
        <Text style={[styles.cellText, styles.colBalance, styles.balanceText]}>
          {formatSigned(item.runningBalance)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScreenHeader title={t("parties.statementTitle", { defaultValue: "Account Statement" })} />

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, index) => item.key || `${item.date}-${index}`}
          ListHeaderComponent={Header}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title={t("parties.noStatementEntries", { defaultValue: "No statement records found" })}
              body={t("parties.noStatementEntriesBody", { defaultValue: "No transactions recorded for this period." })}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  listContent: { padding: 14, paddingBottom: 28 },
  headerContainer: { marginBottom: 8 },
  partyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partyMainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  partyInfo: { flex: 1 },
  partyName: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  partyGroup: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  panBadge: { backgroundColor: colors.bodyBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  panText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  phoneText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },

  presetRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  presetTextActive: { color: "#fff", fontFamily: fonts.semiBold },

  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryCol: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },
  summaryLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted, textTransform: "uppercase", marginBottom: 4 },
  summaryValue: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.text },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  thText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textMuted },

  row: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  rowClickable: { backgroundColor: colors.cardBg },
  cellText: { fontFamily: fonts.regular, fontSize: 11, color: colors.text },

  colDate: { width: 75 },
  colDesc: { flex: 1, paddingRight: 4 },
  descTitle: { fontFamily: fonts.medium, fontSize: 11, color: colors.text },
  precedesText: { fontFamily: fonts.regular, fontSize: 9, color: colors.warning || "#f59e0b" },
  colAmount: { width: 62, textAlign: "right" },
  drAmount: { color: colors.primary, fontFamily: fonts.medium },
  crAmount: { color: colors.success || "#10b981", fontFamily: fonts.medium },
  colBalance: { width: 85, textAlign: "right" },
  balanceText: { fontFamily: fonts.semiBold, fontSize: 11 },
});