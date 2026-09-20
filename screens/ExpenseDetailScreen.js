import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import ScreenHeader from "../components/ui/ScreenHeader";
import StatusBadge from "../components/ui/StatusBadge";
import { colors, tint, accent } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function ExpenseDetailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(
    (isRefresh) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      apiFetch(`/api/mobile/expenses/${id}`)
        .then((data) => { if (mounted.current) setExpense(data); })
        .catch((err) => { if (mounted.current) setError(err.messageKey ? t(err.messageKey) : err.message); })
        .finally(() => {
          if (!mounted.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [id, t],
  );

  useEffect(() => { load(false); }, [load]);

  const isSalary = (expense?.categoryName ?? "").trim().toLowerCase() === "salary";
  const documentTitle = isSalary ? t("expenses.salaryVoucher") : t("expenses.detailTitle");

  const dateText = expense
    ? expense.expenseDateBs
      ? `${expense.expenseDate} · ${expense.expenseDateBs} BS`
      : expense.expenseDate
    : "";

  const fields = expense
    ? [
        { label: t("expenses.expenseNumber"), value: expense.expenseNumber, icon: "hash" },
        { label: t("expenses.voucherNumber"), value: String(expense.voucherNumber), icon: "file-text" },
        { label: t("expenses.expenseDate"), value: dateText, icon: "calendar" },
        { label: t("expenses.category"), value: expense.categoryName, icon: "tag" },
        { label: t("expenses.party"), value: expense.partyName, icon: "user" },
        {
          label: t("expenses.bankAccount"),
          value: expense.bankName ? `${expense.bankName}${expense.accountNumber ? ` · ${expense.accountNumber}` : ""}` : null,
          icon: "credit-card",
        },
        { label: t("expenses.referenceNo"), value: expense.referenceNo, icon: "bookmark" },
        { label: t("expenses.description"), value: expense.description, icon: "align-left" },
        { label: t("expenses.notes"), value: expense.notes, icon: "message-square" },
      ]
    : [];

  const amounts = expense
    ? [
        { label: t("expenses.taxableAmount"), value: formatNpr(expense.taxableAmount) },
        { label: t("expenses.nonTaxableAmount"), value: formatNpr(expense.nonTaxableAmount) },
        { label: t("expenses.subtotal"), value: formatNpr(expense.subtotal) },
        ...(expense.isVatApplicable === 1
          ? [{
              label: `${t("expenses.vatAmount")}${expense.vatPercent ? ` (${Number(expense.vatPercent).toFixed(2)}%)` : ""}`,
              value: formatNpr(expense.vatAmount),
            }]
          : []),
      ]
    : [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={documentTitle} subtitle={expense?.expenseNumber ?? null} />

      {loading ? (
        <View style={styles.body}>
          <SkeletonList rows={6} />
        </View>
      ) : error || !expense ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        >
          <View style={styles.headCard}>
            <View style={styles.headTopRow}>
              <View style={styles.headSquircle}>
                <MaterialCommunityIcons
                  name={isSalary ? "account-cash-outline" : "wallet-outline"}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.headTitleCol}>
                <Text style={styles.headTitle} numberOfLines={1}>
                  {expense.categoryName || expense.description || `#${expense.expenseNumber}`}
                </Text>
                <Text style={styles.headMeta}>{dateText}</Text>
              </View>
              <StatusBadge status={expense.status} />
            </View>

            <View style={styles.amountBanner}>
              <Text style={styles.amountBannerLabel}>{t("expenses.totalExpense", "Total Amount")}</Text>
              <Text style={styles.headAmount}>{formatNpr(expense.amount)}</Text>
            </View>
          </View>

          {expense.status === "cancelled" ? (
            <View style={[styles.notice, { backgroundColor: "#FEF2F2", borderColor: "#FECDD3" }]}>
              <Feather name="alert-triangle" size={14} color="#DC2626" />
              <Text style={[styles.noticeText, { color: "#DC2626" }]}>{t("expenses.cancelledNote")}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary} />
              <Text style={styles.cardSectionTitle}>{t("expenses.details", "Details")}</Text>
            </View>
            {fields.map((field) => (
              <View style={styles.fieldRow} key={field.label}>
                <View style={styles.fieldLabelRow}>
                  <Feather name={field.icon || "circle"} size={12} color={colors.textMuted} />
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                </View>
                <Text style={styles.fieldValue} numberOfLines={3}>
                  {field.value || "—"}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="calculator-variant-outline" size={16} color={colors.primary} />
              <Text style={styles.cardSectionTitle}>{t("expenses.amountBreakdown", "Amount Breakdown")}</Text>
            </View>
            {amounts.map((amount) => (
              <View style={styles.amountRow} key={amount.label}>
                <Text style={styles.amountLabel}>{amount.label}</Text>
                <Text style={styles.amountValue}>{amount.value}</Text>
              </View>
            ))}
            <View style={[styles.amountRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t("expenses.grandTotal")}</Text>
              <Text style={styles.totalValue}>{formatNpr(expense.amount)}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  headCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headTopRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tint("primary", 0.1),
    borderWidth: 1,
    borderColor: tint("primary", 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  headTitleCol: { flex: 1 },
  headTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  headMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  amountBanner: {
    backgroundColor: colors.bodyBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountBannerLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headAmount: { fontFamily: fonts.semiBold, fontSize: 24, color: colors.text },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  noticeText: { fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardSectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  fieldValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, textAlign: "right", maxWidth: "55%" },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  amountLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  amountValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4 },
  totalLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  totalValue: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.primary },
});
