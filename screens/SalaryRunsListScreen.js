import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import BottomFAB from "../components/ui/BottomFAB";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function SalaryRunsListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [yearMonth, setYearMonth] = useState("");
  const [notes, setNotes] = useState("");
  const requestToken = useRef(0);

  const load = useCallback((isRefresh = false) => {
    const token = ++requestToken.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    apiFetch("/api/mobile/payroll/salary-runs")
      .then((data) => {
        if (token !== requestToken.current) return;
        setRuns(Array.isArray(data) ? data : []);
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
    const now = new Date();
    setYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }, [load]);

  async function handleGenerateRun() {
    if (!yearMonth.trim()) return;
    setCreating(true);
    try {
      const result = await apiFetch("/api/mobile/payroll/salary-runs", {
        method: "POST",
        body: {
          yearMonth: yearMonth.trim(),
          notes: notes.trim() || undefined,
        },
      });
      setCreateModalVisible(false);
      setNotes("");
      load(true);
      if (result?.id) {
        router.push(`/payroll/salary-letters/${result.id}`);
      }
    } catch (err) {
      Alert.alert(t("common.somethingWentWrong", "Error"), err.formError || (err.messageKey ? t(err.messageKey) : err.message));
    } finally {
      setCreating(false);
    }
  }

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

  const listPaddingBottom = Math.max(insets.bottom + 88, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("payroll.salaryLetters", "Salary Letters")}
        subtitle={`${runs.length} ${t("payroll.salaryRuns", "Runs")}`}
      />

      {loading && !refreshing ? (
        <View style={styles.content}>
          <SkeletonList rows={5} />
        </View>
      ) : error && runs.length === 0 ? (
        <View style={styles.content}>
          <ErrorState message={error} onRetry={() => load(false)} />
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <EmptyState
              icon="cash-register"
              title={t("payroll.noRecentRuns", "No salary runs yet.")}
              body={t("payroll.noEmployeesDesc", "Generate your first monthly salary run to calculate gross and net pay.")}
              actionLabel={t("payroll.newSalaryRun", "New Salary Run")}
              onAction={() => setCreateModalVisible(true)}
            />
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const periodBs = item.yearMonthBs ? `${item.yearMonthBs} BS` : "";
            const periodAd = item.yearMonth;
            const gross = Number(item.totalGross || 0);
            const net = Number(item.totalNet || 0);

            return (
              <TouchableOpacity
                style={styles.runCard}
                activeOpacity={0.75}
                onPress={() => router.push(`/payroll/salary-letters/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.periodText}>{periodBs ? `${periodBs} · ${periodAd}` : periodAd}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.amountGrid}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>{t("payroll.grossPay", "Gross Total")}</Text>
                    <Text style={styles.grossValue}>{formatNpr(gross)}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>{t("payroll.netPay", "Net Payable")}</Text>
                    <Text style={styles.netValue}>{formatNpr(net)}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailText}>{t("payroll.viewReports", "View Details & Payslips")}</Text>
                  <Feather name="chevron-right" size={18} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <BottomFAB
        label={t("payroll.newSalaryRun", "New Salary Run")}
        icon="plus"
        onPress={() => setCreateModalVisible(true)}
      />

      {/* New Salary Run Modal */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("payroll.newSalaryRun", "Generate Salary Run")}</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Feather name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FormField
              label={t("payroll.payPeriod", "Pay Period (YYYY-MM)")}
              value={yearMonth}
              onChangeText={setYearMonth}
              placeholder="e.g. 2026-09"
            />
            <FormField
              label={t("common.description", "Notes / Remarks")}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Regular monthly salary run"
              multiline
            />

            <View style={styles.modalActions}>
              <Button
                label={t("common.cancel", "Cancel")}
                variant="secondary"
                onPress={() => setCreateModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={t("payroll.generateSalaryRun", "Generate Run")}
                onPress={handleGenerateRun}
                loading={creating}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  content: { padding: 16 },

  runCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  periodText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
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

  amountGrid: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: colors.bodyBg,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  amountCol: { flex: 1 },
  amountLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  grossValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginTop: 2 },
  netValue: { fontFamily: fonts.bold, fontSize: 15, color: "#16A34A", marginTop: 2 },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewDetailText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
});
