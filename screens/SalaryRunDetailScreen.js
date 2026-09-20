import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Share } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import Button from "../components/ui/Button";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function SalaryRunDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);

    apiFetch(`/api/mobile/payroll/salary-runs/${id}`)
      .then((data) => {
        if (token !== requestToken.current) return;
        setRun(data ?? null);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFinalize() {
    Alert.alert(
      t("payroll.finalizeRun", "Finalize Salary Run"),
      t("payroll.finalizeConfirm", "Are you sure you want to finalize this salary run?"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.confirm", "Confirm"),
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiFetch(`/api/mobile/payroll/salary-runs/${id}`, {
                method: "POST",
                body: { action: "finalize" },
              });
              load();
            } catch (err) {
              Alert.alert(t("common.somethingWentWrong", "Error"), err.formError || (err.messageKey ? t(err.messageKey) : err.message));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleDisburse() {
    Alert.alert(
      t("payroll.disburseRun", "Disburse Salary"),
      t("payroll.disburseConfirm", "Are you sure you want to disburse this salary run? This will record accounting ledger entries."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.confirm", "Confirm"),
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiFetch(`/api/mobile/payroll/salary-runs/${id}`, {
                method: "POST",
                body: { action: "disburse" },
              });
              load();
            } catch (err) {
              Alert.alert(t("common.somethingWentWrong", "Error"), err.formError || (err.messageKey ? t(err.messageKey) : err.message));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleShareSlip(line) {
    const text = [
      `*SALARY SLIP - SUVA ERP*`,
      `Period: ${run?.yearMonthBs ? `${run.yearMonthBs} BS (${run.yearMonth})` : run?.yearMonth}`,
      `Employee: ${line.employeeName} (${line.employeeCode})`,
      `Department: ${line.department || "-"}`,
      `Designation: ${line.designation || "-"}`,
      `-----------------------------`,
      `Base Salary: NPR ${formatNpr(Number(line.baseSalary || 0))}`,
      `Allowances: NPR ${formatNpr(Number(line.allowances || 0))}`,
      `Overtime: NPR ${formatNpr(Number(line.overtimeAmount || 0))}`,
      `Gross Pay: NPR ${formatNpr(Number(line.grossPay || 0))}`,
      `Total Deductions: NPR ${formatNpr(Number(line.totalDeductions || 0))}`,
      `-----------------------------`,
      `*NET PAYABLE: NPR ${formatNpr(Number(line.netPay || 0))}*`,
      `Bank: ${line.bankName || "-"} (${line.bankAccountNumber || "-"})`,
    ].join("\n");

    try {
      await Share.share({ message: text });
    } catch {}
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

  const badge = getStatusBadge(run?.status);
  const statusLower = String(run?.status || "").toLowerCase();
  const period = run?.yearMonthBs ? `${run.yearMonthBs} BS (${run.yearMonth})` : run?.yearMonth;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={period || t("payroll.salaryRuns", "Salary Run")}
        subtitle={badge.label}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 40, 48) }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonList rows={6} />
        ) : error || !run ? (
          <ErrorState message={error || t("common.somethingWentWrong")} onRetry={load} />
        ) : (
          <>
            {/* Run Summary Top Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.periodTitle}>{period}</Text>
                  <Text style={styles.periodSub}>{run.lines?.length || 0} {t("payroll.employees", "Employees")}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>

              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>{t("payroll.grossPay", "Gross Total")}</Text>
                  <Text style={styles.totalValue}>{formatNpr(Number(run.totalGross || 0))}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>{t("payroll.totalDeductions", "Deductions")}</Text>
                  <Text style={[styles.totalValue, { color: colors.danger }]}>
                    {formatNpr(Number(run.totalDeductions || 0))}
                  </Text>
                </View>
                <View style={styles.totalItemFull}>
                  <Text style={styles.netLabel}>{t("payroll.netPay", "Net Disbursed / Payable")}</Text>
                  <Text style={styles.netValue}>{formatNpr(Number(run.totalNet || 0))}</Text>
                </View>
              </View>

              {/* Action Buttons for Run status */}
              {statusLower === "draft" && (
                <View style={styles.runActionsRow}>
                  <Button
                    label={t("payroll.finalizeRun", "Finalize Run")}
                    icon="check-circle"
                    onPress={handleFinalize}
                    loading={actionLoading}
                    style={{ flex: 1 }}
                  />
                </View>
              )}

              {statusLower === "finalized" && (
                <View style={styles.runActionsRow}>
                  <Button
                    label={t("payroll.disburseRun", "Disburse Salary (Post Ledger)")}
                    icon="dollar-sign"
                    onPress={handleDisburse}
                    loading={actionLoading}
                    style={{ flex: 1, backgroundColor: "#16A34A" }}
                  />
                </View>
              )}
            </View>

            {/* Employee Salary Lines List */}
            <Text style={styles.sectionTitle}>{t("payroll.salarySlip", "Employee Payslip Breakdown")}</Text>

            {(!run.lines || run.lines.length === 0) ? (
              <Text style={styles.noLinesText}>{t("payroll.noEmployees", "No employee lines in this run.")}</Text>
            ) : (
              run.lines.map((line, index) => {
                const base = Number(line.baseSalary || 0);
                const allow = Number(line.allowances || 0);
                const ot = Number(line.overtimeAmount || 0);
                const gross = Number(line.grossPay || 0);
                const ded = Number(line.totalDeductions || 0);
                const net = Number(line.netPay || 0);

                return (
                  <View style={styles.lineCard} key={line.id || index}>
                    <View style={styles.lineHeader}>
                      <View style={styles.lineInfo}>
                        <Text style={styles.empName}>{line.employeeName}</Text>
                        <Text style={styles.empSub}>
                          {line.employeeCode} {line.designation ? `• ${line.designation}` : ""}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={() => handleShareSlip(line)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.lineBreakdown}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.bdLabel}>{t("payroll.baseSalary", "Base")}:</Text>
                        <Text style={styles.bdValue}>{formatNpr(base)}</Text>
                        <Text style={styles.bdLabel}>{t("payroll.allowances", "Allow")}:</Text>
                        <Text style={styles.bdValue}>{formatNpr(allow)}</Text>
                        <Text style={styles.bdLabel}>{t("payroll.overtimeCost", "OT")}:</Text>
                        <Text style={styles.bdValue}>{formatNpr(ot)}</Text>
                      </View>

                      <View style={[styles.breakdownRow, { marginTop: 6 }]}>
                        <Text style={styles.bdLabel}>{t("payroll.grossPay", "Gross")}:</Text>
                        <Text style={styles.bdValueBold}>{formatNpr(gross)}</Text>
                        <Text style={styles.bdLabel}>{t("payroll.deductions", "Ded")}:</Text>
                        <Text style={[styles.bdValueBold, { color: colors.danger }]}>-{formatNpr(ded)}</Text>
                        <Text style={styles.bdLabel}>{t("payroll.netPay", "Net")}:</Text>
                        <Text style={[styles.bdValueBold, { color: "#16A34A" }]}>{formatNpr(net)}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.viewSlipLink}
                      onPress={() => setSelectedSlip(line)}
                    >
                      <Text style={styles.viewSlipText}>{t("payroll.salarySlip", "View Full Payslip")} &rarr;</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Salary Slip Modal */}
      {selectedSlip && (
        <Modal visible={Boolean(selectedSlip)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("payroll.salarySlip", "Employee Salary Slip")}</Text>
                <TouchableOpacity onPress={() => setSelectedSlip(null)}>
                  <Feather name="x" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.slipCard}>
                  <Text style={styles.slipEmpName}>{selectedSlip.employeeName}</Text>
                  <Text style={styles.slipEmpCode}>{selectedSlip.employeeCode} · {selectedSlip.department || "-"}</Text>

                  <View style={styles.slipDivider} />

                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>{t("payroll.baseSalary", "Base Salary")}</Text>
                    <Text style={styles.slipVal}>{formatNpr(Number(selectedSlip.baseSalary || 0))}</Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>{t("payroll.allowances", "Allowances")}</Text>
                    <Text style={styles.slipVal}>{formatNpr(Number(selectedSlip.allowances || 0))}</Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>{t("payroll.overtimeCost", "Overtime Amount")}</Text>
                    <Text style={styles.slipVal}>{formatNpr(Number(selectedSlip.overtimeAmount || 0))}</Text>
                  </View>
                  <View style={styles.slipRowHighlight}>
                    <Text style={styles.slipLabelBold}>{t("payroll.grossPay", "Gross Pay")}</Text>
                    <Text style={styles.slipValBold}>{formatNpr(Number(selectedSlip.grossPay || 0))}</Text>
                  </View>

                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>{t("payroll.taxDeduction", "Tax / TDS")}</Text>
                    <Text style={[styles.slipVal, { color: colors.danger }]}>
                      -{formatNpr(Number(selectedSlip.taxDeduction || 0))}
                    </Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>{t("payroll.pfDeduction", "PF Deduction")}</Text>
                    <Text style={[styles.slipVal, { color: colors.danger }]}>
                      -{formatNpr(Number(selectedSlip.pfDeduction || 0))}
                    </Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>{t("payroll.otherDeductions", "Other Deductions")}</Text>
                    <Text style={[styles.slipVal, { color: colors.danger }]}>
                      -{formatNpr(Number(selectedSlip.otherDeductions || 0))}
                    </Text>
                  </View>

                  <View style={styles.slipDivider} />

                  <View style={styles.slipNetBox}>
                    <Text style={styles.slipNetLabel}>{t("payroll.netPay", "Net Payable Amount")}</Text>
                    <Text style={styles.slipNetVal}>{formatNpr(Number(selectedSlip.netPay || 0))}</Text>
                  </View>

                  <View style={styles.bankInfoBox}>
                    <Text style={styles.bankInfoText}>
                      {t("payroll.bankName", "Bank")}: {selectedSlip.bankName || "—"}
                    </Text>
                    <Text style={styles.bankInfoText}>
                      {t("payroll.bankAccount", "A/C")}: {selectedSlip.bankAccountNumber || "—"}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalBtns}>
                  <Button
                    label={t("payroll.shareSalarySlip", "Share Slip")}
                    icon="share-2"
                    onPress={() => handleShareSlip(selectedSlip)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t("common.close", "Close")}
                    variant="secondary"
                    onPress={() => setSelectedSlip(null)}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  content: { padding: 16 },

  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  periodTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  periodSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 11 },

  totalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  totalItem: {
    width: "48%",
    backgroundColor: colors.bodyBg,
    padding: 10,
    borderRadius: 8,
  },
  totalItemFull: {
    width: "100%",
    backgroundColor: "#F3EEFF",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  totalValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginTop: 2 },
  netLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: "#7C3AED" },
  netValue: { fontFamily: fonts.bold, fontSize: 16, color: "#7C3AED" },

  runActionsRow: { marginTop: 4 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, marginBottom: 10 },
  noLinesText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 20 },

  lineCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  lineInfo: { flex: 1 },
  empName: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  empSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  shareBtn: { padding: 4 },

  lineBreakdown: {
    backgroundColor: colors.bodyBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bdLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  bdValue: { fontFamily: fonts.medium, fontSize: 11, color: colors.text },
  bdValueBold: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },

  viewSlipLink: { alignSelf: "flex-end", paddingTop: 4 },
  viewSlipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },

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
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  slipCard: {
    backgroundColor: colors.bodyBg,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  slipEmpName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  slipEmpCode: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  slipDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  slipRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  slipRowHighlight: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginVertical: 4,
  },
  slipLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  slipVal: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  slipLabelBold: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  slipValBold: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },

  slipNetBox: {
    backgroundColor: "#DCFCE7",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  slipNetLabel: { fontFamily: fonts.medium, fontSize: 12, color: "#16A34A" },
  slipNetVal: { fontFamily: fonts.bold, fontSize: 18, color: "#16A34A", marginTop: 2 },
  bankInfoBox: { gap: 2 },
  bankInfoText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 24 },
});
