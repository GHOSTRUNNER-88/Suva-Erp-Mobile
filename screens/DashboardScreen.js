import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useModuleAccess } from "../lib/orgSession";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { apiFetch } from "../lib/api";
import { formatNpr, formatNumber } from "../lib/format";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { usePressScale } from "../lib/useFadeInUp";
import AppHeader from "../components/ui/AppHeader";
import StatusBadge from "../components/ui/StatusBadge";
import TrendChart from "../components/TrendChart";
import BottomFAB from "../components/ui/BottomFAB";
import DateField from "../components/ui/DateField";
import { colors, tint, accent } from "../theme/colors";
import { fonts } from "../theme/typography";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PRIVACY_STORAGE_KEY = "suva_balance_privacy_visible";

function TrendArrow({ changePercent, goodDirection = "up" }) {
  const { i18n } = useTranslation();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  if (changePercent === null || changePercent === undefined) return null;
  const isUp = changePercent >= 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  const toneColor = isGood ? "#059669" : "#DC2626";
  const bgTone = isGood ? "#ECFDF5" : "#FEF2F2";
  const borderTone = isGood ? "#A7F3D0" : "#FECDD3";
  const pctStr = formatNumber(Math.abs(changePercent).toFixed(0));

  return (
    <View style={[styles.trendPill, { backgroundColor: bgTone, borderColor: borderTone }]}>
      <Feather name={isUp ? "arrow-up-right" : "arrow-down-right"} size={13} color={toneColor} />
      <Text style={[styles.trendText, { color: toneColor }]}>
        {pctStr}% {isUp ? (isNepali ? "वृद्धि" : "Growth") : (isNepali ? "कमी" : "Down")}
      </Text>
    </View>
  );
}

function StatTrend({ changePercent, goodDirection = "up" }) {
  if (changePercent === null || changePercent === undefined || changePercent === 0) return null;
  const isUp = changePercent > 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  const color = isGood ? "#059669" : "#DC2626";
  const bg = isGood ? "#ECFDF5" : "#FEF2F2";

  return (
    <View style={[styles.statTrendRow, { backgroundColor: bg }]}>
      <Feather name={isUp ? "arrow-up-right" : "arrow-down-right"} size={11} color={color} />
      <Text style={[styles.statTrendText, { color }]}>
        {formatNumber(Math.abs(changePercent).toFixed(1))}%
      </Text>
    </View>
  );
}

function SectionDivider({ title }) {
  return (
    <View style={styles.sectionDividerWrap}>
      <Text style={styles.sectionDividerText}>{title}</Text>
      <View style={styles.sectionDividerLine} />
    </View>
  );
}

function DashboardCard({ title, icon, rightAction, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          {icon ? (
            <View style={styles.sectionHeaderIcon}>
              <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {rightAction}
      </View>
      {children}
    </View>
  );
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

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const canSee = useModuleAccess();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // null = let the server pick its default range; set once the user edits
  // From or To. The fields always show summary.range, the dates the server
  // actually computed the numbers for.
  const [requestedRange, setRequestedRange] = useState(null);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const requestRef = useRef(0);

  // Load balance privacy state (mirrors desktop localStorage suva_balance_privacy_visible)
  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_STORAGE_KEY)
      .then((val) => {
        if (val !== null) setIsBalanceVisible(val === "true");
      })
      .catch(() => {});
  }, []);

  const toggleBalancePrivacy = () => {
    setIsBalanceVisible((prev) => {
      const next = !prev;
      AsyncStorage.setItem(PRIVACY_STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  };

  const load = useCallback(
    (nextRange = requestedRange, mode = "initial") => {
      const token = ++requestRef.current;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      const query = nextRange
        ? `?from=${encodeURIComponent(nextRange.startAd)}&to=${encodeURIComponent(nextRange.endAd)}`
        : "";
      apiFetch(`/api/mobile/dashboard${query}`)
        .then((data) => {
          if (token !== requestRef.current) return;
          setSummary(data);
        })
        .catch((err) => {
          if (token !== requestRef.current) return;
          setError(err.messageKey ? t(err.messageKey) : err.message);
        })
        .finally(() => {
          if (token !== requestRef.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [requestedRange, t],
  );

  useEffect(() => {
    load(requestedRange, "initial");
    return () => {
      requestRef.current += 1;
    };
  }, [requestedRange]);

  const shownRange = summary?.range ?? requestedRange;

  // min/max on the two fields already stop From going past To, so this only
  // has to swap in the edited edge.
  function changeRange(edge, isoAd) {
    if (!isoAd || !shownRange || shownRange[edge] === isoAd) return;
    setRequestedRange({ ...shownRange, [edge]: isoAd });
  }

  // 6 Primary Desktop Quick Actions
  const quickActions = [
    {
      key: "newSale",
      module: "sales",
      label: t("dashboard.quickActionNewSale", isNepali ? "नयाँ बिक्री" : "New Sale"),
      hint: t("dashboard.quickActionNewSaleSub", isNepali ? "बिल जारी गर्नुहोस्" : "Create Invoice"),
      href: "/sales/new",
      icon: "point-of-sale",
      tone: "primary",
      bg: "#F3EEFF",
      border: "#DDD6FE",
      color: "#7D40E5",
    },
    {
      key: "newPurchase",
      module: "purchase",
      label: t("dashboard.quickActionNewPurchase", isNepali ? "नयाँ खरिद" : "New Purchase"),
      hint: t("dashboard.quickActionNewPurchaseSub", isNepali ? "खरिद बिल प्रविष्टि" : "Record Bill"),
      href: "/purchases/new",
      icon: "cart-arrow-down",
      tone: "warning",
      bg: "#FFFBEB",
      border: "#FDE68A",
      color: "#D97706",
    },
    {
      key: "paymentIn",
      module: "finance",
      label: t("dashboard.quickActionPaymentIn", isNepali ? "रकम प्राप्ति (In)" : "Payment In"),
      hint: t("dashboard.quickActionPaymentInSub", isNepali ? "ग्राहक भुक्तानी" : "Receive Money"),
      href: "/payments/new?type=in",
      icon: "arrow-down-left-bold",
      tone: "success",
      bg: "#ECFDF5",
      border: "#A7F3D0",
      color: "#059669",
    },
    {
      key: "paymentOut",
      module: "finance",
      label: t("dashboard.quickActionPaymentOut", isNepali ? "भुक्तानी निकासी (Out)" : "Payment Out"),
      hint: t("dashboard.quickActionPaymentOutSub", isNepali ? "आपूर्तिकर्ता भुक्तानी" : "Pay Supplier"),
      href: "/payments/new?type=out",
      icon: "arrow-up-right-bold",
      tone: "danger",
      bg: "#FEF2F2",
      border: "#FECDD3",
      color: "#DC2626",
    },
    {
      key: "addParty",
      module: "parties",
      label: t("dashboard.quickActionAddParty", isNepali ? "नयाँ पार्टी" : "Add Party"),
      hint: t("dashboard.quickActionAddPartySub", isNepali ? "ग्राहक / आपूर्तिकर्ता" : "Customer / Vendor"),
      href: "/parties/new",
      icon: "account-multiple-plus-outline",
      tone: "info",
      bg: "#F0F9FF",
      border: "#BAE6FD",
      color: "#0284C7",
    },
    {
      key: "staffPayroll",
      module: "payroll",
      label: t("dashboard.quickActionPayroll", isNepali ? "कर्मचारी पेरोल" : "Staff Payroll"),
      hint: t("dashboard.quickActionPayrollSub", isNepali ? "तलब तथा हाजिरी" : "Salaries & Shifts"),
      href: "/payroll",
      icon: "badge-account-outline",
      tone: "purple",
      bg: "#FAF5FF",
      border: "#E9D5FF",
      color: "#9333EA",
    },
  ];

  const hasAnyFigure =
    !!summary &&
    (summary.sales ||
      summary.purchases ||
      summary.cashBank ||
      summary.receivablesDue !== null ||
      summary.payablesDue !== null ||
      summary.expensesThisPeriod !== null ||
      summary.itemCount !== null ||
      summary.partyCount !== null ||
      summary.lowStockCount !== null);

  // Tab screen: the tab bar already clears the system nav inset, so adding
  // insets.bottom here double-counted it (16dp on gesture, 48dp on 3-button).
  const scrollPaddingBottom = 96;

  const formatAmount = (val) => {
    if (!isBalanceVisible) return "NPR •••,•••";
    return formatNpr(val);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <AppHeader
        title={t("dashboard.title", "Dashboard")}
        rightAction={
          <TouchableOpacity
            style={styles.privacyEyeButton}
            onPress={toggleBalancePrivacy}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isBalanceVisible ? t("dashboard.privacyHide") : t("dashboard.privacyShow")}
          >
            <Feather
              name={isBalanceVisible ? "eye" : "eye-off"}
              size={18}
              color={isBalanceVisible ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        }
      />

      {/* Date range filter: From–To, each showing BS and AD */}
      <View style={styles.rangeRow}>
        <View style={styles.rangeField}>
          <DateField
            label={t("dashboard.dateFrom", "From")}
            value={shownRange?.startAd}
            maxDate={shownRange?.endAd}
            onChange={(isoAd) => changeRange("startAd", isoAd)}
            disabled={!shownRange}
            stackedValue
          />
        </View>
        <View style={styles.rangeField}>
          <DateField
            label={t("dashboard.dateTo", "To")}
            value={shownRange?.endAd}
            minDate={shownRange?.startAd}
            onChange={(isoAd) => changeRange("endAd", isoAd)}
            disabled={!shownRange}
            stackedValue
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList rows={5} />
        </View>
      ) : error || !summary ? (
        <ErrorState message={error} onRetry={() => load(requestedRange, "initial")} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(requestedRange, "refresh")}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {!hasAnyFigure ? (
            <EmptyState icon="lock" title={t("dashboard.noAccessTitle")} body={t("dashboard.noAccessBody")} />
          ) : summary.isEmpty ? (
            <EmptyState
              icon="inbox"
              title={t("dashboard.emptyTitle")}
              body={t("dashboard.emptyBody")}
              actionLabel={t("dashboard.emptyAction")}
              onAction={() => router.push("/sales/new")}
            />
          ) : (
            <>
              {/* ZONE 1: EXECUTIVE OVERVIEW */}
              {summary.sales ? (
                <View style={styles.heroOverviewCard}>
                  <View style={styles.heroHeaderRow}>
                    <View style={[styles.heroHeaderIcon, { backgroundColor: tint("primary", 0.1), borderColor: tint("primary", 0.25) }]}>
                      <MaterialCommunityIcons name="point-of-sale" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroCardHeaderTitle}>
                        {t("dashboard.yourSaleOverview", "Your Sale Overview")}
                      </Text>
                    </View>
                    {summary.avgInvoiceValue ? (
                      <View style={styles.avgInvoiceBadge}>
                        <Text style={styles.avgInvoiceBadgeLabel}>{t("dashboard.avgInvoiceValue", "Avg")}</Text>
                        <Text style={styles.avgInvoiceBadgeVal}>
                          {isBalanceVisible ? formatNpr(summary.avgInvoiceValue.current) : "•••"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.heroCardContent}>
                    <Text style={styles.heroTotalLabel}>{t("dashboard.totalSale", "Total Sale")}</Text>
                    <Text style={styles.heroTotalValue}>{formatAmount(summary.sales.current)}</Text>
                    {summary.sales.changePercent !== null && summary.sales.changePercent !== undefined ? (
                      <TrendArrow changePercent={summary.sales.changePercent} goodDirection="up" />
                    ) : null}
                  </View>

                  {summary.trend ? (
                    <View style={styles.heroChartWrap}>
                      <TrendChart points={summary.trend} />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* ZONE 2: DESKTOP QUICK ACTIONS */}
              <SectionDivider title={t("dashboard.quickActionsZone", "Quick Workflows")} />
              <View style={styles.quickActionsGrid}>
                {quickActions.filter((qa) => canSee(qa.module)).map((qa) => (
                  <TouchableOpacity
                    key={qa.key}
                    style={styles.quickActionCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(qa.href)}
                    accessibilityRole="button"
                    accessibilityLabel={qa.label}
                  >
                    <View style={[styles.quickActionIconWrap, { backgroundColor: qa.bg, borderColor: qa.border }]}>
                      <MaterialCommunityIcons name={qa.icon} size={20} color={qa.color} />
                    </View>
                    <View style={styles.quickActionTextWrap}>
                      <Text style={styles.quickActionLabel} numberOfLines={1}>{qa.label}</Text>
                      <Text style={styles.quickActionHint} numberOfLines={1}>{qa.hint}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ZONE 3: SALES & PURCHASES KPI CARDS */}
              <SectionDivider title={t("dashboard.salesPurchasesZone", "Sales & Purchases")} />
              <View style={styles.statsGrid}>
                {summary.sales ? (
                  <StatCard
                    mciIcon="point-of-sale"
                    label={t("dashboard.totalSale")}
                    tone="primary"
                    value={formatAmount(summary.sales.current)}
                    changePercent={summary.sales.changePercent}
                    goodDirection="up"
                    onPress={() => router.push("/sales")}
                  />
                ) : null}

                {summary.purchases ? (
                  <StatCard
                    mciIcon="cart-arrow-down"
                    label={t("dashboard.totalPurchase")}
                    tone="warning"
                    value={formatAmount(summary.purchases.current)}
                    changePercent={summary.purchases.changePercent}
                    goodDirection="down" // spending more is caution
                    onPress={() => router.push("/purchases")}
                  />
                ) : null}
              </View>

              {/* ZONE 4: MONEY & OUTSTANDING DUES */}
              <SectionDivider title={t("dashboard.moneyStockZone", "Money & Outstanding Dues")} />
              <View style={styles.statsGrid}>
                {summary.receivablesDue !== null ? (
                  <StatCard
                    mciIcon="cash-plus"
                    label={t("dashboard.receivablesDue")}
                    cue={isNepali ? "लिन बाँकी" : "To Collect"}
                    tone="info"
                    value={formatAmount(summary.receivablesDue)}
                    onPress={() => router.push("/parties/dues")}
                  />
                ) : null}

                {summary.payablesDue !== null ? (
                  <StatCard
                    mciIcon="cash-minus"
                    label={t("dashboard.payablesDue")}
                    cue={isNepali ? "तिर्न बाँकी" : "To Pay"}
                    tone="danger"
                    value={formatAmount(summary.payablesDue)}
                    onPress={() => router.push("/purchases")}
                  />
                ) : null}

                {summary.cashBank ? (
                  <StatCard
                    mciIcon="bank-outline"
                    label={t("dashboard.cashBankBalance")}
                    tone="teal"
                    value={formatAmount(summary.cashBank.totalBalance)}
                    onPress={() => router.push("/bank-accounts")}
                  />
                ) : null}

                {summary.expensesThisPeriod !== null ? (
                  <StatCard
                    mciIcon="wallet-outline"
                    label={t("dashboard.expensesThisPeriod")}
                    tone="secondary"
                    value={formatAmount(summary.expensesThisPeriod)}
                    onPress={() => router.push("/expenses")}
                  />
                ) : null}
              </View>

              {/* Cash & Bank Accounts breakdown list */}
              {summary.cashBank?.accounts && summary.cashBank.accounts.length > 0 ? (
                <View style={styles.bankAccountsCard}>
                  <View style={styles.bankAccountsHeader}>
                    <MaterialCommunityIcons name="wallet" size={16} color={colors.primary} />
                    <Text style={styles.bankAccountsTitle}>
                      {t("dashboard.accountsBreakdown", "Bank & Cash Accounts")}
                    </Text>
                  </View>
                  {summary.cashBank.accounts.map((acc, index) => (
                    <View
                      key={acc.id ?? index}
                      style={[
                        styles.bankAccountRow,
                        index === summary.cashBank.accounts.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <Text style={styles.bankAccountLabel} numberOfLines={1}>{acc.label}</Text>
                      <Text style={styles.bankAccountBalance}>
                        {formatAmount(acc.balance)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* ZONE 5: ATTENTION NEEDED & INVENTORY ALERTS */}
              {summary.lowStockCount > 0 ? (
                <View style={styles.lowStockBannerCard}>
                  <View style={styles.lowStockHeaderRow}>
                    <View style={styles.lowStockHeaderLeft}>
                      <View style={styles.lowStockIconWrap}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.lowStockTitleRow}>
                          <Text style={styles.lowStockTitle}>
                            {t("dashboard.lowStockAlert", "Low Stock Alert")}
                          </Text>
                          <View style={styles.lowStockCountBadge}>
                            <Text style={styles.lowStockCountBadgeText}>
                              {formatNumber(summary.lowStockCount)} {t("dashboard.itemsUnit", "items")}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.lowStockSubtitle} numberOfLines={1}>
                          {t("dashboard.lowStockReorderNotice", "Items below reorder level")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.lowStockActionsRow}>
                    <TouchableOpacity
                      style={styles.lowStockDrillBtn}
                      onPress={() => router.push("/items/stock-summary")}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                    >
                      <Feather name="list" size={14} color={colors.primary} />
                      <Text style={styles.lowStockDrillText}>
                        {t("dashboard.viewStockList", "Review Stock")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.lowStockQuickActionBtn}
                      onPress={() => router.push("/purchases/new")}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                    >
                      <Feather name="plus-circle" size={14} color="#fff" />
                      <Text style={styles.lowStockQuickActionText}>
                        {t("dashboard.reorderBills", "+ Create Purchase")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* ZONE 6: TOP SELLING PRODUCTS */}
              {summary.topSellingItems && summary.topSellingItems.length > 0 ? (
                <DashboardCard
                  title={t("dashboard.topSellingItems", "Top Selling Products")}
                  icon="star-outline"
                  rightAction={
                    <TouchableOpacity
                      onPress={() => router.push("/items")}
                      style={styles.cardHeaderDrillLink}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                    >
                      <Text style={styles.cardHeaderDrillText}>
                        {t("dashboard.viewAll", "View All")}
                      </Text>
                      <Feather name="arrow-right" size={13} color={colors.primary} />
                    </TouchableOpacity>
                  }
                >
                  {summary.topSellingItems.map((item, idx) => (
                    <View key={item.id ?? idx} style={styles.topItemRow}>
                      <View style={styles.topItemRank}>
                        <Text style={styles.topItemRankText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.topItemDetails}>
                        <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.topItemQty}>
                          {formatNumber(item.qty)} {isNepali ? "थान बिक्री" : "units sold"}
                        </Text>
                      </View>
                      <Text style={styles.topItemValue}>{formatAmount(item.value)}</Text>
                    </View>
                  ))}
                </DashboardCard>
              ) : null}

              {/* ZONE 7: TOP PARTIES */}
              {summary.topParties ? (
                <DashboardCard
                  title={t("dashboard.topParties")}
                  icon="account-group-outline"
                  rightAction={
                    <TouchableOpacity
                      onPress={() => router.push("/parties")}
                      style={styles.cardHeaderDrillLink}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                    >
                      <Text style={styles.cardHeaderDrillText}>
                        {t("dashboard.viewAll", "View All")}
                      </Text>
                      <Feather name="arrow-right" size={13} color={colors.primary} />
                    </TouchableOpacity>
                  }
                >
                  {summary.topParties.length === 0 ? (
                    <Text style={styles.sectionEmpty}>{t("dashboard.noTopParties")}</Text>
                  ) : (
                    <>
                      {summary.topParties.map((party) => {
                        const isReceivable = party.balance >= 0;
                        return (
                          <View key={party.id} style={styles.partyCardRow}>
                            <TouchableOpacity
                              style={styles.partyMainTouchable}
                              activeOpacity={0.75}
                              onPress={() => router.push(`/parties/${party.id}`)}
                            >
                              <View
                                style={[
                                  styles.avatar,
                                  {
                                    backgroundColor: tint(isReceivable ? "success" : "danger", 0.12),
                                    borderColor: tint(isReceivable ? "success" : "danger", 0.28),
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.avatarText,
                                    { color: isReceivable ? colors.success : colors.danger },
                                  ]}
                                >
                                  {initials(party.name)}
                                </Text>
                              </View>
                              <View style={styles.partyTextWrap}>
                                <Text style={styles.partyName} numberOfLines={1}>{party.name}</Text>
                                <Text
                                  style={[
                                    styles.partyBalanceSub,
                                    { color: isReceivable ? colors.success : colors.danger },
                                  ]}
                                >
                                  {formatAmount(Math.abs(party.balance))}{" "}
                                  {isReceivable
                                    ? isNepali ? "लिन बाँकी" : "Receivable"
                                    : isNepali ? "तिर्न बाँकी" : "Payable"}
                                </Text>
                              </View>
                            </TouchableOpacity>

                            <View style={styles.partyActionsGroup}>
                              <TouchableOpacity
                                style={styles.partyQuickActionBtn}
                                activeOpacity={0.75}
                                onPress={() => router.push(`/sales/new?partyId=${party.id}`)}
                                title={t("dashboard.newSale")}
                                accessibilityLabel="Create sale for party"
                              >
                                <MaterialCommunityIcons name="point-of-sale" size={14} color={colors.primary} />
                                <Text style={styles.partyQuickActionText}>
                                  {isNepali ? "+ बिक्री" : "+ Sale"}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.partyDrillChevronBtn}
                                activeOpacity={0.75}
                                onPress={() => router.push(`/parties/${party.id}`)}
                                accessibilityLabel="View party ledger"
                              >
                                <Feather name="chevron-right" size={16} color={colors.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      <TouchableOpacity
                        style={styles.viewAllPartiesFooter}
                        activeOpacity={0.75}
                        onPress={() => router.push("/parties")}
                      >
                        <Text style={styles.viewAllPartiesFooterText}>
                          {t("dashboard.viewAllParties", "View All Parties & Statements")}
                        </Text>
                        <Feather name="arrow-right" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </>
                  )}
                </DashboardCard>
              ) : null}

              {/* ZONE 8: RECENT INVOICES & REPORTS */}
              {summary.recentInvoices ? (
                <DashboardCard title={t("dashboard.recentInvoices")} icon="receipt-text-outline">
                  {summary.recentInvoices.length === 0 ? (
                    <Text style={styles.sectionEmpty}>{t("dashboard.noRecentInvoices")}</Text>
                  ) : (
                    summary.recentInvoices.map((invoice) => (
                      <TouchableOpacity
                        key={invoice.id}
                        style={styles.invoiceRow}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/sales/${invoice.id}`)}
                      >
                        <View style={styles.invoiceMain}>
                          <Text style={styles.invoiceNumber} numberOfLines={1}>{invoice.invoiceNumber}</Text>
                          <Text style={styles.invoiceMeta} numberOfLines={1}>
                            {[invoice.invoiceDate, invoice.partyName].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        <View style={styles.invoiceRight}>
                          <Text style={styles.invoiceAmount}>{formatAmount(invoice.totalAmount)}</Text>
                          <StatusBadge status={invoice.status} />
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </DashboardCard>
              ) : null}

              {/* Reports Card shortcut */}
              <TouchableOpacity
                style={styles.reportsCard}
                onPress={() => router.push("/reports")}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t("dashboard.viewReports")}
              >
                <View style={styles.reportsIcon}>
                  <MaterialCommunityIcons name="file-chart-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.reportsTextWrap}>
                  <Text style={styles.reportsTitle}>
                    {t("dashboard.viewReports", "Reports & Statements")}
                  </Text>
                  <Text style={styles.reportsBody}>
                    {t("dashboard.viewReportsBody", "View Profit & Loss, Balance Sheet, Trial Balance, etc.")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.iconMuted} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {canSee("sales") ? (
        <BottomFAB
          bottomOffset={16}
          label={t("dashboard.addSaleNow", "Add Sale Now")}
          icon="plus"
          onPress={() => router.push("/sales/new")}
        />
      ) : null}
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  mciIcon,
  label,
  value,
  cue,
  danger,
  tone = "primary",
  changePercent,
  goodDirection = "up",
  onPress,
}) {
  const press = usePressScale();
  const activeTone = danger ? "danger" : tone;
  const iconColor = accent(activeTone);
  const iconBg = tint(activeTone, 0.12);
  const iconBorder = activeTone === "danger" ? "#FECDD3" : tint(activeTone, 0.28);

  return (
    <AnimatedTouchable
      style={[styles.statCard, press.style]}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.statCardHeader}>
        <View style={[styles.statIconSquircle, { backgroundColor: iconBg, borderColor: iconBorder }]}>
          {mciIcon ? (
            <MaterialCommunityIcons name={mciIcon} size={20} color={iconColor} />
          ) : (
            <Feather name={icon} size={18} color={iconColor} />
          )}
        </View>
        {cue ? (
          <View style={styles.statCueBadge}>
            <Text style={styles.statCueText}>{cue}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {value}
        </Text>
        <StatTrend changePercent={changePercent} goodDirection={goodDirection} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  loadingWrap: { padding: 16 },
  privacyEyeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.bodyBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeField: { flex: 1 },

  scrollContent: { padding: 16, gap: 14 },
  sectionDividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: -4,
  },
  sectionDividerText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  heroOverviewCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  heroHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroCardHeaderTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  avgInvoiceBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "flex-end",
  },
  avgInvoiceBadgeLabel: { fontFamily: fonts.medium, fontSize: 9, color: colors.textMuted },
  avgInvoiceBadgeVal: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  heroCardContent: { marginBottom: 12 },
  heroTotalLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  heroTotalValue: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginTop: 6,
  },
  trendText: { fontFamily: fonts.semiBold, fontSize: 11 },
  heroChartWrap: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },

  // Quick Workflows Grid
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickActionCard: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  quickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  quickActionTextWrap: { flex: 1 },
  quickActionLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  quickActionHint: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, marginTop: 1 },

  // Stats Grid
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  statCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statCueBadge: {
    backgroundColor: colors.light,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statCueText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.textMuted },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
    flexShrink: 1,
  },
  statTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 2,
  },
  statTrendText: { fontFamily: fonts.bold, fontSize: 10 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Bank accounts card
  bankAccountsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  bankAccountsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  bankAccountsTitle: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  bankAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  bankAccountLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, flex: 1 },
  bankAccountBalance: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },

  // Low stock banner
  lowStockBannerCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    gap: 12,
  },
  lowStockHeaderRow: { flexDirection: "row", alignItems: "center" },
  lowStockHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  lowStockIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lowStockTitle: { fontFamily: fonts.bold, fontSize: 13, color: "#92400E" },
  lowStockCountBadge: {
    backgroundColor: "#D97706",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lowStockCountBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: "#fff" },
  lowStockSubtitle: { fontFamily: fonts.medium, fontSize: 11, color: "#B45309", marginTop: 2 },
  lowStockActionsRow: { flexDirection: "row", gap: 10 },
  lowStockDrillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  lowStockDrillText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary },
  lowStockQuickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
  },
  lowStockQuickActionText: { fontFamily: fonts.semiBold, fontSize: 12, color: "#fff" },

  // Top Items
  topItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  topItemRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
  },
  topItemRankText: { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted },
  topItemDetails: { flex: 1 },
  topItemName: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  topItemQty: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  topItemValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },

  // Standard Section Card
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  cardHeaderDrillLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardHeaderDrillText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary },
  sectionEmpty: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 16,
  },

  // Parties
  partyCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  partyMainTouchable: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 12 },
  partyTextWrap: { flex: 1 },
  partyName: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  partyBalanceSub: { fontFamily: fonts.medium, fontSize: 11, marginTop: 1 },
  partyActionsGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyQuickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  partyQuickActionText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.primary },
  partyDrillChevronBtn: { padding: 4 },
  viewAllPartiesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 12,
  },
  viewAllPartiesFooterText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary },

  // Invoices
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  invoiceMain: { flex: 1, marginRight: 10 },
  invoiceNumber: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  invoiceMeta: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  invoiceRight: { alignItems: "flex-end", gap: 4 },
  invoiceAmount: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },

  // Reports
  reportsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  reportsIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reportsTextWrap: { flex: 1 },
  reportsTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  reportsBody: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
