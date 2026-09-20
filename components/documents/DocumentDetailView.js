import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatNpr } from "../../lib/format";
import { isoAdToIsoBs } from "../../lib/bs-ad";
import { SkeletonList, ErrorState } from "../ui/ListStates";
import BottomSheet from "../ui/BottomSheet";
import StickyActionBar from "../ui/StickyActionBar";
import Button from "../ui/Button";
import { colors, tint } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * Shared layout for the sales invoice and purchase bill detail screens, which
 * show the same kind of document. Each screen keeps its own fetching and
 * action handlers and passes a normalized `doc`. Mirrors desktop's detail view
 * (AGENTS.md §1): number + status, date and party, discount/settled/due, the
 * lines, totals, then Print/Share and WhatsApp, with the rarer and destructive
 * actions (edit, cancel, delete) kept apart in a "More" sheet.
 *
 * doc: { number, status, dateAd, dueDateAd, partyName, partyRows[], detailRows[],
 *        lines[], subtotal, discAmount, vatPercent, vatAmount, totalAmount,
 *        settledLabel, settledAmount, dueAmount, notes }
 * actions: bottom bar buttons [{ key, label, icon, onPress, loading, variant }]
 * menuActions: "More" sheet rows [{ key, label, icon, onPress, destructive, loading }]
 */
export default function DocumentDetailView({ title, icon, loading, error, onRetry, doc, actions = [], menuActions = [] }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const busyMenu = menuActions.some((a) => a.loading);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t("common.back", { defaultValue: "Back" })}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {menuActions.length > 0 ? (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={styles.iconButton}
            disabled={loading || !doc}
            accessibilityRole="button"
            accessibilityLabel={t("home.moreActions", { defaultValue: "More" })}
          >
            {busyMenu ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="more-vertical" size={19} color={colors.text} />}
          </TouchableOpacity>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonList rows={6} />
        </View>
      ) : error || !doc ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <SummaryCard doc={doc} icon={icon} />
            <InfoCard title={t("documentDetail.party", { defaultValue: "Party" })} icon="account-outline" rows={doc.partyRows} />
            <InfoCard title={t("documentDetail.details", { defaultValue: "Details" })} icon="information-outline" rows={doc.detailRows} />
            <LinesCard lines={doc.lines} />
            <TotalsCard doc={doc} />
            {doc.notes ? (
              <View style={styles.card}>
                <SectionHeader icon="note-text-outline" title={t("sale.notes", { defaultValue: "Notes" })} />
                <Text style={styles.notesText}>{doc.notes}</Text>
              </View>
            ) : null}
          </ScrollView>

          {actions.length > 0 ? (
            <StickyActionBar>
              <View style={styles.actionRow}>
                {actions.map((action) => (
                  <View key={action.key} style={styles.actionCell}>
                    <Button
                      label={action.label}
                      icon={action.icon}
                      variant={action.variant ?? "primary"}
                      loading={action.loading}
                      disabled={action.disabled}
                      onPress={action.onPress}
                    />
                  </View>
                ))}
              </View>
            </StickyActionBar>
          ) : null}
        </>
      )}

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t("home.moreActions", { defaultValue: "More" })}>
        {menuActions.map((action, index) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.menuRow, index < menuActions.length - 1 && styles.menuRowDivider]}
            activeOpacity={0.75}
            disabled={action.loading}
            onPress={() => {
              setMenuOpen(false);
              action.onPress();
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: action.destructive ? tint("danger", 0.1) : tint("primary", 0.08) }]}>
              <Feather name={action.icon} size={17} color={action.destructive ? colors.danger : colors.primary} />
            </View>
            <Text style={[styles.menuLabel, action.destructive && { color: colors.danger }]}>{action.label}</Text>
            {action.loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="chevron-right" size={18} color={colors.iconMuted} />}
          </TouchableOpacity>
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

/** "2083-06-01 BS · 2026-09-17 AD" — both calendars, like DateField (AGENTS.md §4). */
export function dualDate(isoAd) {
  if (!isoAd) return "";
  const ad = String(isoAd).slice(0, 10);
  const bs = isoAdToIsoBs(ad);
  return bs ? `${bs} BS · ${ad} AD` : `${ad} AD`;
}

function SummaryCard({ doc, icon }) {
  const { t } = useTranslation();
  const cancelled = doc.status === "cancelled";
  const total = Number(doc.totalAmount ?? 0);
  const settled = Number(doc.settledAmount ?? 0);
  const due = Number(doc.dueAmount ?? 0);
  const progress = total > 0 ? Math.min(1, Math.max(0, settled / total)) : 0;
  const statusTone = cancelled ? colors.danger : due <= 0 ? colors.success : colors.warning;

  return (
    <View style={styles.card}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryIcon}>
          <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.docNumber} numberOfLines={1}>{doc.number}</Text>
          <Text style={styles.partyName} numberOfLines={1}>{doc.partyName}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: `${statusTone}15`, borderColor: `${statusTone}35` }]}>
          <Text style={[styles.statusText, { color: statusTone }]}>
            {cancelled
              ? t("documentDetail.statusCancelled", { defaultValue: "Cancelled" })
              : due <= 0
                ? t("sale.fullyPaid", { defaultValue: "Fully Paid" })
                : t("documentDetail.statusDue", { defaultValue: "Due" })}
          </Text>
        </View>
      </View>

      <View style={styles.metaBlock}>
        <MetaLine icon="calendar" text={dualDate(doc.dateAd)} />
        {doc.dueDateAd ? <MetaLine icon="clock" text={`${t("sale.dueDate", { defaultValue: "Due" })}: ${dualDate(doc.dueDateAd)}`} /> : null}
      </View>

      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>{t("sale.total", { defaultValue: "Total" })}</Text>
        <Text style={[styles.totalValue, cancelled && styles.struck]}>{formatNpr(total)}</Text>
      </View>

      {!cancelled ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: due <= 0 ? colors.success : colors.primary }]} />
          </View>
          <View style={styles.statRow}>
            <Stat label={doc.settledLabel} value={formatNpr(settled)} color={colors.success} />
            <Stat label={t("sale.balance", { defaultValue: "Balance" })} value={formatNpr(due)} color={due > 0 ? colors.danger : colors.text} align="right" />
          </View>
        </>
      ) : null}
    </View>
  );
}

function MetaLine({ icon, text }) {
  return (
    <View style={styles.metaLine}>
      <Feather name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function Stat({ label, value, color, align = "left" }) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoCard({ title, icon, rows }) {
  const visible = (rows ?? []).filter((row) => row.value !== null && row.value !== undefined && String(row.value).trim() !== "");
  if (visible.length === 0) return null;
  return (
    <View style={styles.card}>
      <SectionHeader icon={icon} title={title} />
      {visible.map((row, index) => (
        <View key={row.label} style={[styles.infoRow, index > 0 && styles.infoRowDivider]}>
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={styles.infoValue} selectable>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function LinesCard({ lines }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <SectionHeader icon="package-variant-closed" title={`${t("sale.items", { defaultValue: "Items" })} (${lines.length})`} />
      {lines.map((line, idx) => {
        const lineDiscount = Number(line.discAmount ?? 0);
        return (
          <View key={line.id ?? idx} style={[styles.lineRow, idx > 0 && styles.infoRowDivider]}>
            <View style={styles.lineIndex}>
              <Text style={styles.lineIndexText}>{idx + 1}</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.lineName} numberOfLines={2}>
                {line.itemName}
                {line.variantName ? <Text style={styles.lineVariant}>{`  ·  ${line.variantName}`}</Text> : null}
              </Text>
              <Text style={styles.lineMeta}>
                {`${Number(line.quantity)} ${line.unitCode ?? ""} × ${formatNpr(line.rate)}`}
              </Text>
              {lineDiscount > 0 ? (
                <Text style={styles.lineDiscount}>{`${t("sale.discount", { defaultValue: "Discount" })} − ${formatNpr(lineDiscount)}`}</Text>
              ) : null}
            </View>
            <Text style={styles.lineTotal}>{formatNpr(line.lineTotal)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TotalsCard({ doc }) {
  const { t } = useTranslation();
  const discount = Number(doc.discAmount ?? 0);
  const vat = Number(doc.vatAmount ?? 0);
  const due = Number(doc.dueAmount ?? 0);
  const cancelled = doc.status === "cancelled";
  return (
    <View style={styles.card}>
      <SectionHeader icon="calculator-variant-outline" title={t("sale.totalsHeading", { defaultValue: "Totals" })} />
      <TotalsRow label={t("sale.subtotal", { defaultValue: "Subtotal" })} value={formatNpr(doc.subtotal)} />
      {discount > 0 ? <TotalsRow label={t("sale.discount", { defaultValue: "Discount" })} value={`− ${formatNpr(discount)}`} /> : null}
      {vat > 0 ? <TotalsRow label={`${t("sale.vat", { defaultValue: "VAT" })}${Number(doc.vatPercent) ? ` (${Number(doc.vatPercent)}%)` : ""}`} value={formatNpr(vat)} /> : null}
      <View style={styles.grandRow}>
        <Text style={styles.grandLabel}>{t("sale.total", { defaultValue: "Total" })}</Text>
        <Text style={styles.grandValue}>{formatNpr(doc.totalAmount)}</Text>
      </View>
      {!cancelled ? (
        <>
          <TotalsRow label={doc.settledLabel} value={formatNpr(doc.settledAmount)} valueColor={colors.success} />
          <View style={[styles.balancePill, { backgroundColor: due <= 0 ? "#ECFDF5" : "#FEF2F2", borderColor: due <= 0 ? "#A7F3D0" : "#FECDD3" }]}>
            <Text style={[styles.balanceLabel, { color: due <= 0 ? "#059669" : "#DC2626" }]}>{t("sale.balance", { defaultValue: "Balance" })}</Text>
            <Text style={[styles.balanceValue, { color: due <= 0 ? "#059669" : "#DC2626" }]}>
              {due <= 0 ? t("sale.fullyPaid", { defaultValue: "Fully Paid" }) : formatNpr(due)}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function TotalsRow({ label, value, valueColor }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <Text style={[styles.totalsValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  flex1: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, textAlign: "center" },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSpacer: { width: 38 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  summaryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tint("primary", 0.1),
    borderWidth: 1,
    borderColor: tint("primary", 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  docNumber: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  partyName: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statusChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: fonts.semiBold, fontSize: 11 },

  metaBlock: { gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },

  totalBlock: { marginTop: 14 },
  totalLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  totalValue: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, marginTop: 2 },
  struck: { textDecorationLine: "line-through", color: colors.textMuted },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginTop: 12, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  statValue: { fontFamily: fonts.semiBold, fontSize: 14, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: tint("primary", 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },

  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingVertical: 9 },
  infoRowDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  infoLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  infoValue: { flex: 1, textAlign: "right", fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  lineRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  lineIndex: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  lineIndexText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  lineName: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  lineVariant: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  lineMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  lineDiscount: { fontFamily: fonts.regular, fontSize: 11, color: colors.success, marginTop: 2 },
  lineTotal: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },

  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  totalsLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  totalsValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grandLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  grandValue: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.primary },
  balancePill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  balanceLabel: { fontFamily: fonts.semiBold, fontSize: 13 },
  balanceValue: { fontFamily: fonts.semiBold, fontSize: 14 },

  notesText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.text },

  actionRow: { flexDirection: "row", gap: 10 },
  actionCell: { flex: 1 },

  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  menuRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
});
