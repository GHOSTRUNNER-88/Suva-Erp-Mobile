import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import ScreenHeader from "../components/ui/ScreenHeader";
import DateField from "../components/ui/DateField";
import Button from "../components/ui/Button";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import { isoAdToBs, toIso } from "../lib/bs-ad";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const TITLES = {
  "sales-summary": "salesSummary",
  "sales-register": "salesRegister",
  "purchase-register": "purchaseRegister",
  "customer-ageing": "customerAgeing",
  "supplier-ageing": "supplierAgeing",
  "inventory-summary": "inventorySummary",
  "low-stock": "lowStock",
  "vat-summary": "vatSummary",
  "profit-loss": "profitLoss",
  "balance-sheet": "balanceSheet",
  "trial-balance": "trialBalance",
  "day-book": "dayBook",
  "bank-statement": "bankStatement",
};
const MONEY_KEYS = /amount|balance|debit|credit|total|due|value|cost|sales|purchase/i;
const DATE_KEYS = /date/i;

/**
 * Local calendar day, not the UTC one. `toISOString().slice(0,10)` converts
 * to UTC first, so on a device in Nepal (UTC+5:45) every report opened after
 * 18:15 local defaulted its end date to YESTERDAY and silently excluded the
 * whole current day's transactions.
 */
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function startOfYear() { return `${new Date().getFullYear()}-01-01`; }
function labelFor(key) { return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }
function displayValue(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (DATE_KEYS.test(key) && typeof value === "string" && isoAdToBs(value)) return `${toIso(isoAdToBs(value))} BS · ${value} AD`;
  // Money must be matched before the String() fallback whether the report
  // hands it back as a number or as a raw DECIMAL string — the number-only
  // check used to let a string amount through as unformatted "1234.5000".
  if (MONEY_KEYS.test(key) && (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))))) {
    return formatNpr(value);
  }
  if (typeof value === "boolean") return value ? "✓" : "—";
  return String(value);
}

export default function ReportViewerScreen() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams();
  const reportSlug = Array.isArray(slug) ? slug[0] : slug;
  const [startAd, setStartAd] = useState(startOfYear());
  const [endAd, setEndAd] = useState(todayIso());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);
  const title = t(`reports.${TITLES[reportSlug] ?? "title"}`);

  const load = useCallback(() => {
    // Changing either date re-runs this, and "Run" can be tapped again while
    // one is in flight — token so an older run can't overwrite a newer one.
    const token = ++requestToken.current;
    setLoading(true); setError(null);
    apiFetch(`/api/mobile/reports/${reportSlug}`, { method: "POST", body: { startAd, endAd, page: 1, pageSize: 100, hideZeroQuantity: true } })
      .then((data) => {
        if (token !== requestToken.current) return;
        setResult(data ?? null);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
        // Otherwise the previous run's rows stay on screen under a new date
        // range, reading as this range's result.
        setResult(null);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [endAd, reportSlug, startAd, t]);

  useEffect(() => { load(); }, [load]);
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  // Union of every row's keys, not just the first row's: a report whose first
  // row happened to omit an optional field used to hide that column for the
  // whole table.
  const columns = useMemo(() => {
    const seen = [];
    for (const row of rows) {
      for (const key of Object.keys(row ?? {})) if (!seen.includes(key)) seen.push(key);
    }
    return seen;
  }, [rows]);
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.filters}>
          <DateField label={t("reports.startDate", { defaultValue: "Start Date" })} value={startAd} onChange={setStartAd} />
          <DateField label={t("reports.endDate", { defaultValue: "End Date" })} value={endAd} onChange={setEndAd} />
          <Button
            label={t("reports.run", { defaultValue: "Generate Report" })}
            onPress={load}
            loading={loading}
            style={styles.runBtn}
          />
        </View>
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {loading && !result ? <SkeletonList rows={6} /> : null}
        {!loading && result && rows.length === 0 ? (
          <EmptyState icon="bar-chart-2" title={t("reports.noRows", { defaultValue: "No records found for this period" })} />
        ) : null}
        {rows.map((row, index) => (
          <View style={styles.rowCard} key={`${reportSlug}-${index}`}>
            {columns.map((key, cIdx) => (
              <View style={[styles.cell, cIdx === columns.length - 1 && styles.lastCell]} key={key}>
                <Text style={styles.cellLabel}>{labelFor(key)}</Text>
                <Text style={styles.cellValue}>{displayValue(key, row[key])}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  content: { padding: 16, paddingBottom: 40 },
  filters: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  runBtn: {
    marginTop: 6,
  },
  rowCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cell: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 8,
  },
  lastCell: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  cellLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    flex: 1,
  },
  cellValue: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    textAlign: "right",
  },
});
