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

export default function NoteDetailScreen({ type: propType }) {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const id = params.id;
  const isCredit = (propType || params.type) !== "debit";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    const endpoint = isCredit ? `/api/mobile/credit-notes/${id}` : `/api/mobile/debit-notes/${id}`;
    apiFetch(endpoint)
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
  }, [id, isCredit, t]);

  useEffect(() => {
    load();
  }, [load]);

  const note = data;
  const lines = Array.isArray(note?.lines) ? note.lines : [];
  const noteNumber = isCredit ? note?.creditNoteNumber : note?.debitNoteNumber;
  const noteDate = isCredit ? note?.creditNoteDate : note?.debitNoteDate;
  const headerTitle = isCredit
    ? t("creditDebit.creditDetailTitle", { defaultValue: "Credit Note Detail" })
    : t("creditDebit.debitDetailTitle", { defaultValue: "Debit Note Detail" });

  const summaryRows = [];
  if (note) {
    if (note.subtotal != null) {
      summaryRows.push({ label: t("sale.subtotal", { defaultValue: "Subtotal" }), value: note.subtotal });
    }
    if (Number(note.discAmount || 0) > 0) {
      summaryRows.push({
        label: `${t("sale.discount", { defaultValue: "Discount" })}${note.discPercent ? ` (${note.discPercent}%)` : ""}`,
        value: note.discAmount,
      });
    }
    if (Number(note.vatAmount || 0) > 0) {
      summaryRows.push({
        label: `${t("sale.vat", { defaultValue: "VAT" })}${note.vatPercent ? ` (${note.vatPercent}%)` : ""}`,
        value: note.vatAmount,
      });
    }
    if (note.isRefunded && Number(note.refundAmount || 0) > 0) {
      summaryRows.push({
        label: `${t("forms.settlementRefundedToggle", { defaultValue: "Refunded" })}${note.bankName ? ` (${note.bankName})` : ""}`,
        value: note.refundAmount,
      });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScreenHeader
        title={headerTitle}
        right={
          note ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: `/${isCredit ? "credit-notes" : "debit-notes"}/edit/${id}`, params: { type: isCredit ? "credit" : "debit" } })}
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
      ) : error || !note ? (
        <ErrorState message={error ?? t("common.somethingWentWrong")} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.docNumber}>{noteNumber || `#${note.id}`}</Text>
              <StatusBadge status={note.status || "completed"} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("common.date", { defaultValue: "Date" })}:</Text>
              <Text style={styles.metaValue}>{noteDate || "-"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("sale.party", { defaultValue: "Party" })}:</Text>
              <Text style={styles.metaValue}>
                {note.partyName || "-"}
                {note.partyPhone ? ` (${note.partyPhone})` : ""}
              </Text>
            </View>
            {note.warehouseName ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("forms.warehouse", { defaultValue: "Warehouse" })}:</Text>
                <Text style={styles.metaValue}>{note.warehouseName}</Text>
              </View>
            ) : null}
            {note.referenceNo ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("forms.referenceNo", { defaultValue: "Reference No." })}:</Text>
                <Text style={styles.metaValue}>{note.referenceNo}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("sale.items", { defaultValue: "Items" })} ({lines.length})</Text>
            {lines.map((line, index) => (
              <View key={line.id ?? index} style={[styles.lineItemRow, index > 0 && styles.lineDivider]}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineName}>{line.itemName || `#${line.itemId}`}</Text>
                  <Text style={styles.lineMeta}>
                    {line.quantity} {line.unitCode || ""} � {formatNpr(line.rate)}
                  </Text>
                </View>
                <Text style={styles.lineTotal}>{formatNpr(line.lineTotal ?? Number(line.quantity || 0) * Number(line.rate || 0))}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <MoneySummary
              rows={summaryRows}
              totalLabel={t("sale.total", { defaultValue: "Total" })}
              totalValue={note.totalAmount}
            />
          </View>

          {note.notes ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t("forms.notes", { defaultValue: "Notes" })}</Text>
              <Text style={styles.notesText}>{note.notes}</Text>
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
