import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function PayrollDashboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback((isRefresh = false) => {
    const token = ++requestToken.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    Promise.all([
      apiFetch("/api/mobile/payroll/dashboard").catch(() => null),
      apiFetch("/api/mobile/payroll/salary-runs").catch(() => []),
      apiFetch("/api/mobile/payroll/employees").catch(() => []),
    ])
      .then(([dash, runs, emps]) => {
        if (token !== requestToken.current) return;
        const totalEmployees = emps.length;
        const activeEmployees = emps.filter((e) => e.isActive === 1 || e.status === "active").length;
        const pendingSalaryLetters = (runs || []).filter((r) => r.status === "draft").length;
        const latestRun = (runs || [])[0];
        const thisMonthExpense = latestRun ? Number(latestRun.totalGross || 0) : dash?.latestRun ? Number(dash.latestRun.totalGross || 0) : 0;

        setData({
          totalEmployees: dash?.activeEmployeesCount ?? totalEmployees,
          activeEmployees: dash?.activeEmployeesCount ?? activeEmployees,
          thisMonthExpense,
          pendingSalaryLetters,
          recentRuns: runs || [],
          hasEmployees: totalEmployees > 0,
        });
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

  const quickActions = [
    {
      key: "addEmployee",
      label: t("payroll.addEmployee", "Add Employee"),
      icon: "account-plus-outline",
      href: "/payroll/employees/new",
      bg: "#EDE9FE",
      border: "#DDD6FE",
      color: "#7C3AED",
    },
    {
      key: "attendance",
      label: t("payroll.recordAttendance", "Record Attendance"),
      icon: "calendar-check-outline",
      href: "/payroll/attendance",
      bg: "#DCFCE7",
      border: "#BBF7D0",
      color: "#16A34A",
    },
    {
      key: "salaryRun",
      label: t("payroll.newSalaryRun", "New Salary Run"),
      icon: "cash-register",
      href: "/payroll/salary-letters",
      bg: "#FEF3C7",
      border: "#FDE68A",
      color: "#D97706",
    },
    {
      key: "reports",
      label: t("payroll.viewReports", "View Reports"),
      icon: "chart-box-outline",
      href: "/payroll/reports",
      bg: "#E0F2FE",
      border: "#BAE6FD",
      color: "#0284C7",
    },
  ];

  function getStatusBadge(status) {
    const s = String(status).toLowerCase();
    if (s === "disbursed") {
      return { label: t("payroll.disbursed", "Disbursed"), bg: "#DCFCE7", color: "#16A34A" };
    }
    if (s === "finalized") {
      return { label: t("payroll.finalized", "Finalized"), bg: "#E0F2FE", color: "#0284C7" };
    }
    return { label: t("payroll.draft", "Draft"), bg: "#FEF3C7", color: "#D97706" };
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("payroll.dashboard", "Payroll Dashboard")}
        subtitle={t("payroll.title", "Payroll")}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading && !data ? (
          <SkeletonList rows={5} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => load(false)} />
        ) : (
          <>
            {/* Stat Cards Grid */}
            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={styles.statCard}
                activeOpacity={0.8}
                onPress={() => router.push("/payroll/employees")}
              >
                <View style={[styles.statIcon, { backgroundColor: "#EDE9FE" }]}>
                  <MaterialCommunityIcons name="account-group-outline" size={22} color="#7C3AED" />
                </View>
                <Text style={styles.statValue}>{data?.totalEmployees ?? 0}</Text>
                <Text style={styles.statLabel}>{t("payroll.totalEmployees", "Total Employees")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                activeOpacity={0.8}
                onPress={() => router.push("/payroll/employees")}
              >
                <View style={[styles.statIcon, { backgroundColor: "#DCFCE7" }]}>
                  <MaterialCommunityIcons name="account-check-outline" size={22} color="#16A34A" />
                </View>
                <Text style={[styles.statValue, { color: "#16A34A" }]}>{data?.activeEmployees ?? 0}</Text>
                <Text style={styles.statLabel}>{t("payroll.activeEmployees", "Active Employees")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                activeOpacity={0.8}
                onPress={() => router.push("/payroll/reports")}
              >
                <View style={[styles.statIcon, { backgroundColor: "#E0F2FE" }]}>
                  <MaterialCommunityIcons name="cash-multiple" size={22} color="#0284C7" />
                </View>
                <Text style={styles.statValue}>{formatNpr(data?.thisMonthExpense ?? 0)}</Text>
                <Text style={styles.statLabel}>{t("payroll.thisMonthExpense", "This Month's Payroll")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                activeOpacity={0.8}
                onPress={() => router.push("/payroll/salary-letters")}
              >
                <View style={[styles.statIcon, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={22} color="#D97706" />
                </View>
                <Text style={[styles.statValue, { color: "#D97706" }]}>{data?.pendingSalaryLetters ?? 0}</Text>
                <Text style={styles.statLabel}>{t("payroll.pendingLetters", "Pending Salary Letters")}</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Actions Strip */}
            <Text style={styles.sectionHeader}>{t("payroll.quickActions", "Quick Actions")}</Text>
            <View style={styles.quickActionsRow}>
              {quickActions.map((qa) => (
                <TouchableOpacity
                  key={qa.key}
                  style={[styles.quickActionBtn, { borderColor: qa.border, backgroundColor: qa.bg }]}
                  activeOpacity={0.8}
                  onPress={() => router.push(qa.href)}
                >
                  <MaterialCommunityIcons name={qa.icon} size={20} color={qa.color} />
                  <Text style={[styles.quickActionLabel, { color: qa.color }]} numberOfLines={1}>
                    {qa.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Salary Runs Table/List */}
            <View style={styles.runsHeaderRow}>
              <Text style={styles.sectionHeader}>{t("payroll.recentRuns", "Recent Salary Runs")}</Text>
              <TouchableOpacity onPress={() => router.push("/payroll/salary-letters")}>
                <Text style={styles.viewAllLink}>{t("common.all", "View All")} &rarr;</Text>
              </TouchableOpacity>
            </View>

            {(!data?.recentRuns || data.recentRuns.length === 0) ? (
              <EmptyState
                icon="cash"
                title={t("payroll.noRecentRuns", "No salary runs yet.")}
                body={t("payroll.noEmployeesDesc", "Get started by adding employees and generating your first salary run.")}
                actionLabel={t("payroll.newSalaryRun", "New Salary Run")}
                onAction={() => router.push("/payroll/salary-letters")}
              />
            ) : (
              <View style={styles.card}>
                {data.recentRuns.slice(0, 5).map((run, index) => {
                  const badge = getStatusBadge(run.status);
                  const period = run.yearMonthBs ? `${run.yearMonthBs} BS (${run.yearMonth})` : run.yearMonth;
                  return (
                    <TouchableOpacity
                      key={run.id || index}
                      style={[styles.runRow, index < Math.min(data.recentRuns.length, 5) - 1 && styles.rowDivider]}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/payroll/salary-letters/${run.id}`)}
                    >
                      <View style={styles.runInfo}>
                        <Text style={styles.runTitle}>{period}</Text>
                        <Text style={styles.runSubtitle}>
                          {t("payroll.grossPay", "Gross")}: {formatNpr(run.totalGross || 0)} · {t("payroll.netPay", "Net")}: {formatNpr(run.totalNet || 0)}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.iconMuted} />
                    </TouchableOpacity>
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

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },

  sectionHeader: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickActionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },

  runsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  viewAllLink: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  runRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  runInfo: {
    flex: 1,
  },
  runTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  runSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
});
