import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function PayrollReportsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback((isRefresh = false) => {
    const token = ++requestToken.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    apiFetch("/api/mobile/payroll/reports")
      .then((data) => {
        if (token !== requestToken.current) return;
        setReportData(data ?? null);
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
  }, [t]);

  useEffect(() => {
    load(false);
  }, [load]);

  const totals = reportData?.totals || {
    totalGross: 0,
    totalDeductions: 0,
    totalNet: 0,
    totalOvertime: 0,
    count: 0,
  };

  const deptSummaries = reportData?.departmentSummary || [];
  const maxDeptGross = Math.max(...deptSummaries.map((d) => Number(d.totalGross || 0)), 1);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("payroll.reports", "Payroll Reports")}
        subtitle={t("payroll.title", "Payroll")}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading && !refreshing ? (
          <SkeletonList rows={6} />
        ) : error && !reportData ? (
          <ErrorState message={error} onRetry={() => load(false)} />
        ) : (
          <>
            {/* Monthly Payroll Expense Summary */}
            <Text style={styles.sectionTitle}>{t("payroll.monthlyTrend", "Monthly Payroll Expense Summary")}</Text>
            <View style={styles.summaryCard}>
              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>{t("payroll.grossPay", "Total Gross Pay")}</Text>
                  <Text style={styles.grossValue}>{formatNpr(totals.totalGross)}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>{t("payroll.totalDeductions", "Total Deductions")}</Text>
                  <Text style={[styles.totalValue, { color: colors.danger }]}>
                    {formatNpr(totals.totalDeductions)}
                  </Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>{t("payroll.overtimeCost", "Total Overtime")}</Text>
                  <Text style={styles.totalValue}>{formatNpr(totals.totalOvertime)}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>{t("payroll.totalEmployees", "Processed Staff")}</Text>
                  <Text style={styles.totalValue}>{totals.count}</Text>
                </View>
                <View style={styles.totalItemFull}>
                  <Text style={styles.netLabel}>{t("payroll.netPay", "Net Disbursed")}</Text>
                  <Text style={styles.netValue}>{formatNpr(totals.totalNet)}</Text>
                </View>
              </View>
            </View>

            {/* Department-wise cost breakdown */}
            <Text style={styles.sectionTitle}>{t("payroll.departmentBreakdown", "Department-wise Cost Breakdown")}</Text>
            {deptSummaries.length === 0 ? (
              <EmptyState
                icon="chart-bar"
                title={t("payroll.noEmployees", "No department data yet")}
                body={t("payroll.noEmployeesDesc", "Department expense charts will show here once salary runs are generated.")}
              />
            ) : (
              <View style={styles.card}>
                {deptSummaries.map((dept, index) => {
                  const gross = Number(dept.totalGross || 0);
                  const pct = Math.round((gross / maxDeptGross) * 100);

                  return (
                    <View
                      key={dept.department || index}
                      style={[styles.deptRow, index < deptSummaries.length - 1 && styles.rowDivider]}
                    >
                      <View style={styles.deptHeader}>
                        <View style={styles.deptNameWrap}>
                          <MaterialCommunityIcons name="domain" size={18} color={colors.primary} />
                          <Text style={styles.deptName}>{dept.department || "General"}</Text>
                        </View>
                        <Text style={styles.deptGross}>{formatNpr(gross)}</Text>
                      </View>

                      {/* Bar Visualization */}
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>

                      <View style={styles.deptMeta}>
                        <Text style={styles.deptMetaText}>
                          {dept.employeesCount} {t("payroll.employees", "staff")}
                        </Text>
                        <Text style={styles.deptMetaText}>
                          {t("payroll.netPay", "Net")}: {formatNpr(dept.totalNet || 0)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  content: { padding: 16 },

  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  totalItem: {
    width: "48%",
    backgroundColor: colors.bodyBg,
    padding: 12,
    borderRadius: 10,
  },
  totalItemFull: {
    width: "100%",
    backgroundColor: "#F3EEFF",
    padding: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  totalValue: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, marginTop: 2 },
  grossValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, marginTop: 2 },
  netLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: "#7C3AED" },
  netValue: { fontFamily: fonts.bold, fontSize: 18, color: "#7C3AED" },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  deptRow: {
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  deptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  deptNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deptName: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  deptGross: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },

  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginBottom: 6,
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },

  deptMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deptMetaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
