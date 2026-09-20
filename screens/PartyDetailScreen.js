import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import ScreenHeader from "../components/ui/ScreenHeader";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * Real data via GET /api/mobile/parties/[id] — mirrors desktop's
 * /parties/[id] page (PartyDetailView + PartyLedgerView combined onto one
 * screen: profile card + period summary + filters + paginated ledger).
 *
 * Party-ledger rebuild (2026-09, AUDIT FINDINGS #12): this screen used to
 * fetch the party's ENTIRE all-time ledger in one shot with no filters, no
 * pagination, and dropped the API's own `periodTotals` on the floor —
 * showing every row via a plain `.map()` with no Dr/Cr suffix on the
 * running balance either. Now: server-computed opening/period debit/period
 * credit/closing (never recomputed client-side — AGENTS.md §5), a type
 * filter using the API's own `filterCounts`, a simple date-range preset
 * (this screen has no BS/AD date PICKER yet — no date-bearing screen in
 * this app does, see AGENTS.md's own "still-open dual-calendar gap" note;
 * the three presets below are AD-only client math used only to choose
 * which `from`/`to` to ask the server for, never to compute a total), real
 * pagination via "load more", and Dr/Cr suffixes matching desktop's
 * `formatSigned()`. Tapping a row navigates to its real source document
 * where a mobile screen for that document type actually exists (Sales
 * Invoice, Purchase Bill) — every other type stays plain (no fabricated
 * link to a screen that doesn't exist).
 */

const PAGE_SIZE = 20;

const DOCUMENT_ROUTES = {
  salesInvoice: (id) => `/sales/${id}`,
  purchaseBill: (id) => `/purchases/${id}`,
  creditNote: (id) => `/credit-notes/${id}`,
  debitNote: (id) => `/debit-notes/${id}`,
  salesOrder: (id) => `/sales-orders/${id}`,
  purchaseOrder: (id) => `/purchase-orders/${id}`,
};

/**
 * Formats a Date's LOCAL calendar day as YYYY-MM-DD.
 *
 * These bounds used to go through `toISOString().slice(0,10)`, which
 * converts to UTC first: a local-midnight 1st-of-the-month in Nepal
 * (UTC+5:45) becomes the previous day in UTC, so "This Month" asked the
 * server for a window starting on the last day of the PREVIOUS month and
 * pulled that day's entries — and its opening balance — into the period.
 */
function localIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthBounds(monthsAgo) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return { from: localIso(start), to: localIso(end) };
}

export default function PartyDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [datePreset, setDatePreset] = useState("all");
  const requestToken = useRef(0);

  const range = useMemo(() => {
    if (datePreset === "thisMonth") return monthBounds(0);
    if (datePreset === "lastMonth") return monthBounds(1);
    return null;
  }, [datePreset]);

  const buildUrl = useCallback(
    (page) => {
      const params = new URLSearchParams();
      if (range) {
        params.set("from", range.from);
        params.set("to", range.to);
      }
      if (typeFilter) params.set("type", typeFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return `/api/mobile/parties/${id}?${params.toString()}`;
    },
    [id, range, typeFilter],
  );

  const load = useCallback(() => {
    // Every type-filter chip and date preset triggers a fresh load, and
    // useFocusEffect fires one too. Tapping two chips quickly used to let the
    // first (slower) response land last, showing rows that don't match the
    // selected filter.
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    apiFetch(buildUrl(1))
      .then((result) => {
        if (token !== requestToken.current) return;
        setData(result ?? null);
        setEntries(Array.isArray(result?.entries) ? result.entries : []);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [buildUrl, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const loadMore = useCallback(() => {
    const pagination = data?.pagination;
    if (!pagination || loadingMore || pagination.page >= pagination.totalPages) return;
    // Captured, not incremented: a load() started while this page is in
    // flight bumps the token and makes this response a no-op, so a stale page
    // can't be appended onto a freshly-filtered list (which would also have
    // produced duplicate `key` values in the FlatList).
    const token = requestToken.current;
    setLoadingMore(true);
    apiFetch(buildUrl(pagination.page + 1))
      .then((result) => {
        if (token !== requestToken.current) return;
        setData(result ?? null);
        setEntries((prev) => [...prev, ...(Array.isArray(result?.entries) ? result.entries : [])]);
      })
      .catch(() => {})
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoadingMore(false);
      });
  }, [buildUrl, data, loadingMore]);

  const party = data?.party;
  const periodTotals = data?.periodTotals;
  const filterCounts = data?.filterCounts ?? {};
  const balance = Number(party?.balance ?? 0);
  const isDr = balance >= 0;

  function formatSigned(amount) {
    const n = Number(amount);
    return `${formatNpr(Math.abs(n))} ${n < 0 ? t("parties.cr") : t("parties.dr")}`;
  }

  function balanceMeaning() {
    if (Math.abs(balance) < 0.005) return t("parties.ledgerBalanceMeaningZero");
    return isDr ? t("parties.ledgerBalanceMeaningDr") : t("parties.ledgerBalanceMeaningCr");
  }

  function onRowPress(entry) {
    if (entry.sourceId === null) return;
    const routeFn = DOCUMENT_ROUTES[entry.label];
    if (routeFn) router.push(routeFn(entry.sourceId));
  }

function initials(name) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const DOCUMENT_ICONS = {
  salesInvoice: { icon: "point-of-sale", color: colors.primary, bg: "#F3EEFF" },
  purchaseBill: { icon: "cart-arrow-down", color: "#D97706", bg: "#FEF7EB" },
  creditNote: { icon: "file-undo-outline", color: "#DB2777", bg: "#FDF2F8" },
  debitNote: { icon: "file-replace-outline", color: "#7C3AED", bg: "#F5F3FF" },
  salesOrder: { icon: "clipboard-text-outline", color: "#2563EB", bg: "#EFF6FF" },
  purchaseOrder: { icon: "clipboard-check-outline", color: "#059669", bg: "#ECFDF5" },
};

  const typeOptions = Object.keys(filterCounts);

  function Header() {
    return (
      <View>
        <View style={styles.card}>
          <View style={styles.nameRow}>
            <View style={styles.partyAvatarSquircle}>
              <Text style={styles.partyAvatarText}>{initials(party.name)}</Text>
            </View>
            <View style={styles.partyNameCol}>
              <Text style={styles.partyName}>{party.name}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{t(`parties.type${party.type}`)}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.balancePanel, { backgroundColor: isDr ? "#F0FDF4" : "#FEF2F2", borderColor: isDr ? "#BBF7D0" : "#FECDD3" }]}>
            <Text style={styles.balanceLabel}>{t("parties.currentBalance")}</Text>
            <Text style={[styles.balanceValue, { color: isDr ? "#15803D" : "#DC2626" }]}>
              {formatNpr(Math.abs(balance))} {isDr ? t("parties.dr") : t("parties.cr")}
            </Text>
            <Text style={styles.balanceMeaning}>{balanceMeaning()}</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Feather name="phone" size={13} color={colors.textMuted} />
              <Text style={styles.detailLabel}>{t("parties.phone")}</Text>
            </View>
            <Text style={styles.detailValue}>{party.phoneNumber || "—"}</Text>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Feather name="hash" size={13} color={colors.textMuted} />
              <Text style={styles.detailLabel}>{t("parties.panNumber")}</Text>
            </View>
            <Text style={styles.detailValue}>{party.panNumber || "—"}</Text>
          </View>
          <View style={[styles.detailRow, { marginBottom: 14 }]}>
            <View style={styles.detailLabelRow}>
              <MaterialCommunityIcons name="credit-card-outline" size={14} color={colors.textMuted} />
              <Text style={styles.detailLabel}>{t("parties.creditLimit")}</Text>
            </View>
            <Text style={styles.detailValue}>{formatNpr(party.creditLimit)}</Text>
          </View>

          <TouchableOpacity
            style={styles.statementButton}
            onPress={() => router.push(`/parties/${party.id}/statement`)}
            activeOpacity={0.7}
          >
            <View style={styles.statementButtonInner}>
              <View style={styles.statementIconSquircle}>
                <MaterialCommunityIcons name="file-chart-outline" size={17} color={colors.primary} />
              </View>
              <Text style={styles.statementButtonText}>{t("parties.statementTitle", { defaultValue: "Account Statement" })}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.iconMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.presetRow}>
            {[
              ["all", t("parties.ledgerPresetAllTime")],
              ["thisMonth", t("parties.ledgerPresetThisMonth")],
              ["lastMonth", t("parties.ledgerPresetLastMonth")],
            ].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.presetChip, datePreset === value && styles.presetChipActive]}
                onPress={() => setDatePreset(value)}
              >
                <Text style={[styles.presetChipText, datePreset === value && styles.presetChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {periodTotals ? (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>{t("parties.ledgerOpening")}</Text>
                <Text style={styles.summaryValue}>{formatSigned(periodTotals.opening)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>{t("parties.ledgerTotalDebit")}</Text>
                <Text style={styles.summaryValue}>{formatNpr(periodTotals.debit)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>{t("parties.ledgerTotalCredit")}</Text>
                <Text style={styles.summaryValue}>{formatNpr(periodTotals.credit)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>{t("parties.ledgerClosing")}</Text>
                <Text style={[styles.summaryValue, styles.summaryValueStrong]}>{formatSigned(periodTotals.closing)}</Text>
              </View>
            </View>
          ) : null}

          {typeOptions.length > 0 ? (
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[styles.presetChip, !typeFilter && styles.presetChipActive]}
                onPress={() => setTypeFilter(null)}
              >
                <Text style={[styles.presetChipText, !typeFilter && styles.presetChipTextActive]}>{t("parties.ledgerFilterAllTypes")}</Text>
              </TouchableOpacity>
              {typeOptions.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.presetChip, typeFilter === label && styles.presetChipActive]}
                  onPress={() => setTypeFilter(label)}
                >
                  <Text style={[styles.presetChipText, typeFilter === label && styles.presetChipTextActive]}>
                    {t(`parties.ledgerLabels.${label}`, label)} ({filterCounts[label]})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{t("parties.ledger")}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScreenHeader
        title={t("parties.detailTitle")}
        right={
          party ? (
            <TouchableOpacity
              onPress={() => router.push(`/parties/edit/${id}`)}
              hitSlop={8}
              style={styles.editButton}
              accessibilityRole="button"
              accessibilityLabel="Edit Party"
            >
              <Feather name="edit-2" size={17} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonList rows={7} />
        </View>
      ) : error || !party ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry, index) => String(entry?.key ?? `${entry?.label ?? "row"}-${entry?.sourceId ?? index}`)}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={Header}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : data?.pagination && data.pagination.page < data.pagination.totalPages ? (
              <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
                <Text style={styles.loadMoreText}>{t("parties.ledgerLoadMore")}</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.card}>
              <Text style={styles.emptyBody}>{t("parties.ledgerNoEntriesTitle")}</Text>
            </View>
          }
          renderItem={({ item: entry }) => {
            const isLinkable = entry.sourceId !== null && !!DOCUMENT_ROUTES[entry.label];
            const RowWrapper = isLinkable ? TouchableOpacity : View;
            const docMeta = DOCUMENT_ICONS[entry.label] || { icon: "file-document-outline", color: colors.primary, bg: tint("primary", 0.1) };

            return (
              <RowWrapper style={styles.ledgerRowCard} onPress={isLinkable ? () => onRowPress(entry) : undefined} activeOpacity={0.8}>
                <View style={[styles.docIconSquircle, { backgroundColor: docMeta.bg }]}>
                  <MaterialCommunityIcons name={docMeta.icon} size={18} color={docMeta.color} />
                </View>
                <View style={styles.ledgerRowLeft}>
                  <View style={styles.ledgerLabelRow}>
                    <Text style={styles.ledgerLabel} numberOfLines={1}>
                      {t(`parties.ledgerLabels.${entry.label}`, entry.label)}
                    </Text>
                    {entry.precedesOpeningDate ? <Feather name="alert-triangle" size={12} color={colors.danger} style={{ marginLeft: 6 }} /> : null}
                  </View>
                  <Text style={styles.ledgerMeta} numberOfLines={1}>
                    {entry.date}
                    {entry.reference ? ` · ${entry.reference}` : ""}
                  </Text>
                </View>
                <View style={styles.ledgerRowRight}>
                  <Text style={[styles.ledgerAmount, entry.debit > 0 ? styles.debitText : styles.creditText]}>
                    {entry.debit > 0 ? `${formatNpr(entry.debit)} ${t("parties.dr")}` : entry.credit > 0 ? `${formatNpr(entry.credit)} ${t("parties.cr")}` : "—"}
                  </Text>
                  <Text style={styles.runningBalance}>{formatSigned(entry.runningBalance)}</Text>
                </View>
              </RowWrapper>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  partyAvatarSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tint("primary", 0.1),
    borderWidth: 1,
    borderColor: tint("primary", 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  partyAvatarText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primary,
  },
  partyNameCol: { flex: 1 },
  partyName: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(152,95,253,0.08)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(152,95,253,0.2)",
  },
  typeBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary },

  balancePanel: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  balanceLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textTransform: "uppercase", marginBottom: 4 },
  balanceValue: { fontFamily: fonts.semiBold, fontSize: 22 },
  balanceMeaning: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  detailLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  detailValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },

  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: 10, marginTop: 4 },
  emptyBody: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 16 },

  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.bodyBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  presetChipTextActive: { color: "#fff", fontFamily: fonts.semiBold },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.bodyBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  summaryCell: { width: "50%", padding: 6 },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textTransform: "uppercase" },
  summaryValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginTop: 2 },
  summaryValueStrong: { fontSize: 14, color: colors.primary },

  ledgerRowCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  docIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  ledgerRowLeft: { flex: 1 },
  ledgerRowRight: { alignItems: "flex-end" },
  ledgerLabelRow: { flexDirection: "row", alignItems: "center" },
  ledgerLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  ledgerMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ledgerAmount: { fontFamily: fonts.semiBold, fontSize: 13 },
  debitText: { color: colors.text },
  creditText: { color: colors.danger },
  runningBalance: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  loadMoreButton: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 12,
  },
  loadMoreText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },

  statementButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bodyBg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  statementButtonInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  statementIconSquircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: tint("primary", 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  statementButtonText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
});
