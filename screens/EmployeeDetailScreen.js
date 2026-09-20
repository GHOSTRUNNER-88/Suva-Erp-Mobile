import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import { isoAdToBs, toIso } from "../lib/bs-ad";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function EmployeeDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);

    apiFetch(`/api/mobile/payroll/employees/${id}`)
      .then((data) => {
        if (token !== requestToken.current) return;
        setEmployee(data ?? null);
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

  async function handleToggleStatus() {
    if (!employee || updating) return;
    const isActive = employee.isActive === 1 || employee.status === "active";
    const action = isActive ? "deactivate" : "activate";
    const confirmMsg = isActive
      ? t("payroll.deactivateConfirm", "Are you sure you want to deactivate this employee?")
      : t("payroll.activateConfirm", "Are you sure you want to activate this employee?");

    Alert.alert(
      isActive ? t("payroll.deactivate", "Deactivate") : t("payroll.activate", "Activate"),
      confirmMsg,
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.confirm", "Confirm"),
          style: isActive ? "destructive" : "default",
          onPress: async () => {
            setUpdating(true);
            try {
              await apiFetch(`/api/mobile/payroll/employees/${id}`, {
                method: "PATCH",
                body: { action },
              });
              setEmployee((prev) => ({
                ...prev,
                isActive: isActive ? 0 : 1,
                status: isActive ? "inactive" : "active",
              }));
            } catch (err) {
              Alert.alert(t("common.somethingWentWrong", "Error"), err.messageKey ? t(err.messageKey) : err.message);
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  }

  const isActive = employee?.isActive === 1 || employee?.status === "active";
  const baseSalary = Number(employee?.baseSalary || 0);
  const allowances = Number(employee?.allowances || 0);
  const totalSalary = baseSalary + allowances;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={employee?.fullName || t("payroll.employeeDetails", "Employee Details")}
        subtitle={employee?.code || t("payroll.title", "Payroll")}
        right={
          employee ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/payroll/employees/new", params: { id: employee.id } })}
              hitSlop={8}
            >
              <Feather name="edit-2" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonList rows={6} />
        ) : error || !employee ? (
          <ErrorState message={error || t("common.somethingWentWrong")} onRetry={load} />
        ) : (
          <>
            {/* Top Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarWrap}>
                <MaterialCommunityIcons name="account" size={36} color={colors.primary} />
              </View>
              <View style={styles.profileHeader}>
                <Text style={styles.name}>{employee.fullName}</Text>
                {employee.fullNameNe ? <Text style={styles.nameNe}>{employee.fullNameNe}</Text> : null}
                <View style={styles.badgeRow}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{employee.code}</Text>
                  </View>
                  <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                      {isActive ? t("payroll.active", "Active") : t("payroll.inactive", "Inactive")}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Salary Highlights Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("payroll.financialInfo", "Salary & Banking")}</Text>
              <View style={styles.salaryGrid}>
                <View style={styles.salaryItem}>
                  <Text style={styles.salaryLabel}>{t("payroll.baseSalary", "Base Salary")}</Text>
                  <Text style={styles.salaryValue}>{formatNpr(baseSalary)}</Text>
                </View>
                <View style={styles.salaryItem}>
                  <Text style={styles.salaryLabel}>{t("payroll.allowances", "Allowances")}</Text>
                  <Text style={styles.salaryValue}>{formatNpr(allowances)}</Text>
                </View>
                <View style={styles.salaryItemFull}>
                  <Text style={styles.salaryLabelTotal}>{t("payroll.grossPay", "Gross Monthly Pay")}</Text>
                  <Text style={styles.salaryValueTotal}>{formatNpr(totalSalary)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.panNumber", "PAN Number")}</Text>
                <Text style={styles.detailValue}>{employee.panNumber || "—"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.bankName", "Bank Name")}</Text>
                <Text style={styles.detailValue}>{employee.bankName || "—"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.bankAccount", "Account Number")}</Text>
                <Text style={styles.detailValue}>{employee.bankAccountNumber || "—"}</Text>
              </View>
            </View>

            {/* Employment Details Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("payroll.employmentInfo", "Employment Details")}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.department", "Department")}</Text>
                <Text style={styles.detailValue}>{employee.department || "—"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.designation", "Designation")}</Text>
                <Text style={styles.detailValue}>{employee.designation || "—"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.joinDate", "Join Date")}</Text>
                <Text style={styles.detailValue}>
                  {employee.joinDate
                    ? `${employee.joinDate} AD ${isoAdToBs(employee.joinDate) ? `(${toIso(isoAdToBs(employee.joinDate))} BS)` : ""}`
                    : "—"}
                </Text>
              </View>
            </View>

            {/* Contact Details Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("payroll.personalInfo", "Contact Information")}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.phone", "Phone Number")}</Text>
                <Text style={styles.detailValue}>{employee.phoneNumber || "—"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("payroll.email", "Email")}</Text>
                <Text style={styles.detailValue}>{employee.email || "—"}</Text>
              </View>
            </View>

            {/* Actions: Edit & Deactivate/Activate */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.editBtn}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: "/payroll/employees/new", params: { id: employee.id } })}
              >
                <Feather name="edit-2" size={18} color="#FFFFFF" />
                <Text style={styles.editBtnText}>{t("payroll.editEmployee", "Edit Employee")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusBtn, isActive ? styles.deactivateBtn : styles.activateBtn]}
                activeOpacity={0.8}
                onPress={handleToggleStatus}
                disabled={updating}
              >
                <Feather name={isActive ? "user-x" : "user-check"} size={18} color={isActive ? colors.danger : "#16A34A"} />
                <Text style={[styles.statusBtnText, { color: isActive ? colors.danger : "#16A34A" }]}>
                  {isActive ? t("payroll.deactivate", "Deactivate Employee") : t("payroll.activate", "Activate Employee")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  content: { padding: 16 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeader: { flex: 1 },
  name: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.text },
  nameNe: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  codeBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: { fontFamily: fonts.semiBold, fontSize: 11, color: "#7C3AED" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusActive: { backgroundColor: "#DCFCE7" },
  statusInactive: { backgroundColor: "#FEE2E2" },
  statusText: { fontFamily: fonts.semiBold, fontSize: 11 },
  statusTextActive: { color: "#16A34A" },
  statusTextInactive: { color: "#DC2626" },

  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  salaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  salaryItem: {
    width: "48%",
    backgroundColor: colors.bodyBg,
    padding: 10,
    borderRadius: 8,
  },
  salaryItemFull: {
    width: "100%",
    backgroundColor: "#F3EEFF",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  salaryLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  salaryValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginTop: 2 },
  salaryLabelTotal: { fontFamily: fonts.semiBold, fontSize: 13, color: "#7C3AED" },
  salaryValueTotal: { fontFamily: fonts.bold, fontSize: 16, color: "#7C3AED" },

  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  detailValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  actionButtons: { marginTop: 10, gap: 10 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  editBtnText: { fontFamily: fonts.semiBold, fontSize: 14, color: "#FFFFFF" },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    backgroundColor: colors.cardBg,
  },
  deactivateBtn: { borderColor: colors.dangerLight },
  activateBtn: { borderColor: "#DCFCE7" },
  statusBtnText: { fontFamily: fonts.semiBold, fontSize: 14 },
});
