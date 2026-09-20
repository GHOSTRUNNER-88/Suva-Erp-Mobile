import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModuleAccess } from "../lib/orgSession";
import { View, Image, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, RefreshControl, Modal, Linking, Share, TextInput, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr, formatNumber } from "../lib/format";
import { isoAdToBs, getCurrentBsDate, formatBsDate, todayIsoAd, getNepaliFiscalYearStartBs } from "../lib/bs-ad";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import AppHeader from "../components/ui/AppHeader";
import BottomFAB from "../components/ui/BottomFAB";
import ListRow from "../components/ui/ListRow";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const FINTECH_QUICK_ACTIONS = [
  { key: "newSale", module: "sales", icon: "point-of-sale", href: "/sales/new", labelKey: "home.newSale", bg: "#F3EEFF", border: "#DDD6FE", color: "#985FFD" },
  { key: "newPurchase", module: "purchase", icon: "cart-arrow-down", href: "/purchases/new", labelKey: "home.newPurchase", bg: "#FFF3EC", border: "#FED7AA", color: "#FA8128" },
  { key: "paymentIn", module: "finance", icon: "arrow-down-left-bold", href: "/payments/new?type=in", labelKey: "home.paymentIn", bg: "#EBFBF3", border: "#BBF7D0", color: "#32D484" },
  { key: "paymentOut", module: "finance", icon: "arrow-up-right-bold", href: "/payments/new?type=out", labelKey: "home.paymentOut", bg: "#FFF1F0", border: "#FECDD3", color: "#FF6757" },
  { key: "addParty", module: "parties", icon: "account-multiple-plus-outline", href: "/parties/new", labelKey: "home.addParty", bg: "#E6FAFF", border: "#BAE6FD", color: "#00C9FF" },
  { key: "addItem", module: "items", icon: "package-variant-closed-plus", href: "/items/new", labelKey: "home.addItem", bg: "#FAECFD", border: "#F5D0FE", color: "#BE2BEB" },
  { key: "staffPayroll", module: "payroll", icon: "badge-account-outline", href: "/payroll", labelKey: "home.staffPayroll", bg: "#FEF8E7", border: "#FDE68A", color: "#F7B500" },
  { key: "moreActions", icon: "dots-grid", action: "openMore", labelKey: "home.moreActions", bg: "#ECF8F7", border: "#A7F3D0", color: "#35B5AA" },
];

const ADD_TXN_ACTIONS = [
  { key: "sale", module: "sales", icon: "point-of-sale", href: "/sales/new", labelKey: "sale.createTitle", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "purchase", module: "purchase", icon: "cart-arrow-down", href: "/purchases/new", labelKey: "purchase.createTitle", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "paymentIn", module: "finance", icon: "cash-plus", href: "/payments/new?type=in", labelKey: "home.paymentIn", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
  { key: "paymentOut", module: "finance", icon: "cash-minus", href: "/payments/new?type=out", labelKey: "home.paymentOut", bg: "#FFE4E6", border: "#FECDD3", color: "#E11D48" },
  { key: "salesOrder", module: "sales", icon: "clipboard-text-outline", href: "/sales-orders/new", labelKey: "salesOrders.newTitle", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "purchaseOrder", module: "purchase", icon: "clipboard-plus-outline", href: "/purchase-orders/new", labelKey: "purchaseOrders.newTitle", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "creditNote", module: "sales", icon: "file-undo-outline", href: "/credit-notes/new", labelKey: "creditDebit.creditTitle", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
  { key: "debitNote", module: "purchase", icon: "file-replace-outline", href: "/debit-notes/new", labelKey: "creditDebit.debitTitle", bg: "#FFE4E6", border: "#FECDD3", color: "#E11D48" },
  { key: "expense", module: "finance", icon: "wallet-outline", href: "/expenses/new", labelKey: "expenses.createTitle", bg: "#FCE7F3", border: "#FBCFE8", color: "#DB2777" },
  { key: "deal", module: "crm", icon: "target", href: "/deals/new", labelKey: "crm.createTitle", bg: "#CCFBF1", border: "#99F6E4", color: "#0D9488" },
  { key: "item", module: "items", icon: "package-variant-closed", href: "/items/new", labelKey: "items.createTitle", bg: "#F5F3FF", border: "#EDE9FE", color: "#8B5CF6" },
  { key: "employee", module: "payroll", icon: "account-plus-outline", href: "/payroll/employees/new", labelKey: "payroll.addEmployee", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "attendance", module: "payroll", icon: "calendar-check-outline", href: "/payroll/attendance", labelKey: "payroll.attendance", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
  { key: "salaryRun", module: "payroll", icon: "cash-register", href: "/payroll/salary-letters", labelKey: "payroll.salaryRuns", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
];

function QuickActionTile({ action, label, onPress }) {
  const press = usePressScale();

  return (
    <AnimatedTouchable
      style={[styles.quickActionTile, press.style]}
      activeOpacity={0.88}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.quickActionIconWrap, { backgroundColor: action.bg, borderColor: action.border }]}>
        <MaterialCommunityIcons name={action.icon} size={22} color={action.color} />
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

function getPartyInitials(name) {
  if (!name) return "CS";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function EnhancedTransactionCard({ item, delay = 0, onPress, onShare }) {
  const { t, i18n } = useTranslation();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const press = usePressScale();
  const enterAnimation = useFadeInUp(delay);

  const isCancelled = item.status === "cancelled";
  const due = Number(item.dueAmount ?? 0);
  const total = Number(item.totalAmount ?? 0);
  const isPaid = !isCancelled && due <= 0;
  const isPartial = !isCancelled && due > 0 && due < total;
  const isDue = !isCancelled && due >= total;

  let badgeTone = colors.success;
  let badgeBg = colors.successLight;
  let badgeLabel = isNepali ? "चुक्ता" : "PAID";

  if (isCancelled) {
    badgeTone = colors.danger;
    badgeBg = colors.dangerLight;
    badgeLabel = isNepali ? "रद्द" : "CANCELLED";
  } else if (isPartial) {
    badgeTone = colors.warning;
    badgeBg = colors.warningLight;
    badgeLabel = isNepali ? "आंशिक" : "PARTIAL";
  } else if (isDue) {
    badgeTone = colors.danger;
    badgeBg = colors.dangerLight;
    badgeLabel = isNepali ? "बाँकी" : "DUE";
  }

  // Dual calendar conversion
  const bs = item.invoiceDate ? isoAdToBs(item.invoiceDate) : null;
  const bsStr = bs ? `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}` : null;
  const dateDisplay = bsStr ? `${bsStr} BS` : item.invoiceDate;

  return (
    <AnimatedTouchable
      style={[styles.txnCard, enterAnimation, press.style]}
      activeOpacity={0.88}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
    >
      <View style={styles.txnCardTopRow}>
        <View style={styles.partyAvatarWrap}>
          <Text style={styles.partyAvatarText}>{getPartyInitials(item.partyName)}</Text>
        </View>
        <View style={styles.txnCardMeta}>
          <View style={styles.partyTitleRow}>
            <Text style={styles.txnPartyName} numberOfLines={1}>
              {item.partyName || (isNepali ? "नगद बिक्री" : "Cash Sale")}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.statusBadgeText, { color: badgeTone }]}>{badgeLabel}</Text>
            </View>
          </View>
          <View style={styles.docSubRow}>
            <Text style={styles.docNumber}>#{formatNumber(item.invoiceNumber)}</Text>
            <Text style={styles.docDot}>•</Text>
            <Text style={styles.docDate}>{formatNumber(dateDisplay)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.txnCardBottomRow}>
        <View style={styles.amountsGroup}>
          <View style={styles.amountItem}>
            <Text style={styles.amountMutedLabel}>{isNepali ? "कुल रकम" : "Total"}</Text>
            <Text style={styles.amountStrongVal}>{formatNpr(item.totalAmount)}</Text>
          </View>
          {due > 0 ? (
            <View style={styles.amountItem}>
              <Text style={styles.amountMutedLabel}>{isNepali ? "लिन बाँकी" : "Due"}</Text>
              <Text style={[styles.amountStrongVal, { color: colors.danger }]}>{formatNpr(due)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardActionIcons}>
          {onShare ? (
            <TouchableOpacity style={styles.miniActionBtn} onPress={onShare} hitSlop={8}>
              <Feather name="share-2" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.miniActionBtn} onPress={onPress} hitSlop={8}>
            <Feather name="chevron-right" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedTouchable>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const canSee = useModuleAccess();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const [tab, setTab] = useState("transactionDetails");
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [addTxnOpen, setAddTxnOpen] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const requestToken = useRef(0);
  const [setupUrl, setSetupUrl] = useState(null);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      apiFetch("/api/mobile/session")
        .then((sessionData) => {
          if (token !== requestToken.current) return null;
          if (sessionData?.hasOrganization === false) {
            setSetupUrl(sessionData.setupUrl ?? null);
            setError(null);
            return null;
          }
          setSession(sessionData);

          return Promise.all([
            apiFetch("/api/mobile/dashboard").catch(() => null),
            apiFetch("/api/parties").catch(() => []),
            apiFetch("/api/mobile/sales-invoices").catch(() => []),
          ]).then(([dashData, partiesData, invoicesData]) => {
            if (token !== requestToken.current) return;
            if (dashData) setSummary(dashData);
            setParties(Array.isArray(partiesData) ? partiesData : []);
            setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
            setError(null);
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
    },
    [t],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  function goToAddTxnAction(href) {
    setAddTxnOpen(false);
    router.push(href);
  }

  function handleShare(item) {
    const text = isNepali
      ? `सुभा ERP - बिक्री बिल #${item.invoiceNumber}\nग्राहक: ${item.partyName || "नगद बिक्री"}\nकुल रकम: ${formatNpr(item.totalAmount)}\nलिन बाँकी: ${formatNpr(item.dueAmount)}`
      : `Suva ERP - Sale Invoice #${item.invoiceNumber}\nParty: ${item.partyName || "Cash Sale"}\nTotal: ${formatNpr(item.totalAmount)}\nDue: ${formatNpr(item.dueAmount)}`;
    Share.share({ message: text });
  }

  // Today BS & AD string for top banner
  const todayAd = useMemo(() => todayIsoAd(), []);
  const todayBs = useMemo(() => {
    const cd = isoAdToBs(todayAd) || getCurrentBsDate();
    if (!cd) return "";
    return formatBsDate(cd, isNepali ? "ne" : "en");
  }, [todayAd, isNepali]);

  const fiscalYearString = useMemo(() => {
    const fyStartBs = getNepaliFiscalYearStartBs(todayAd);
    const startYear = fyStartBs.slice(0, 4);
    const endYearShort = String(Number(startYear) + 1).slice(2);
    return `${startYear}/${endYearShort}`;
  }, [todayAd]);

  // Filtered transactions
  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (inv) =>
          (inv.partyName || "").toLowerCase().includes(q) ||
          String(inv.invoiceNumber || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter === "unpaid") {
      result = result.filter((inv) => Number(inv.dueAmount) > 0 && inv.status !== "cancelled");
    } else if (statusFilter === "paid") {
      result = result.filter((inv) => Number(inv.dueAmount) <= 0 && inv.status !== "cancelled");
    }
    return result;
  }, [invoices, searchQuery, statusFilter]);

  // Filtered parties
  const filteredParties = useMemo(() => {
    let result = parties;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.phoneNumber || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter === "receivable") {
      result = result.filter((p) => Number(p.balance ?? 0) > 0);
    } else if (statusFilter === "payable") {
      result = result.filter((p) => Number(p.balance ?? 0) < 0);
    }
    return result;
  }, [parties, searchQuery, statusFilter]);

  if (setupUrl) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.setupPrompt}>
          <View style={styles.logoBadge}>
            <Image source={require("../assets/android-icon-foreground.png")} style={styles.logoImage} />
          </View>
          <Text style={styles.setupPromptTitle}>{t("home.needsSetupTitle")}</Text>
          <Text style={styles.setupPromptBody}>{t("home.needsSetupBody")}</Text>
          <TouchableOpacity style={styles.setupPromptButton} onPress={() => Linking.openURL(setupUrl)}>
            <Text style={styles.setupPromptButtonText}>{t("home.needsSetupButton")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Tab screen: the tab bar already clears the system nav inset, so adding
  // insets.bottom here double-counted it (16dp on gesture, 48dp on 3-button).
  const listPaddingBottom = 96;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: listPaddingBottom }}
      >
        {/* Date & Fiscal Year Ribbon Banner */}
        <View style={styles.dateBannerRow}>
          <View style={styles.dateBannerPill}>
            <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.primary} />
            <Text style={styles.dateBannerText}>{todayBs}</Text>
          </View>
          <View style={styles.fyBannerPill}>
            <Text style={styles.fyBannerText}>
              {t("home.fiscalYear")}: {formatNumber(fiscalYearString)}
            </Text>
          </View>
        </View>

        {/* FinTech Financial Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroMutedTitle}>{t("home.cashAndBank")}</Text>
              <Text style={styles.heroCashValue}>
                {isBalanceVisible
                  ? formatNpr(summary?.cashBank?.totalBalance ?? 0)
                  : "••••••••"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setIsBalanceVisible((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isBalanceVisible ? t("home.hideBalance") : t("home.showBalance")}
            >
              <Feather name={isBalanceVisible ? "eye" : "eye-off"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroDuesRow}>
            {/* To Collect (Receivables) */}
            <TouchableOpacity
              style={styles.duesCol}
              activeOpacity={0.75}
              onPress={() => router.push("/sales?filter=due")}
              accessibilityRole="button"
              accessibilityLabel={`${t("home.toCollect")}: ${summary?.receivablesDue ?? 0}`}
            >
              <View style={styles.duesHeader}>
                <View style={[styles.duesIndicator, { backgroundColor: colors.successLight }]}>
                  <Feather name="arrow-down-left" size={13} color={colors.success} />
                </View>
                <Text style={styles.duesLabel}>{t("home.toCollect")}</Text>
                <Feather name="chevron-right" size={13} color={colors.textSubtle} style={styles.duesChevron} />
              </View>
              <Text style={[styles.duesAmount, { color: colors.success }]}>
                {isBalanceVisible
                  ? `+ ${formatNpr(summary?.receivablesDue ?? 0)}`
                  : "••••••"}
              </Text>
              <Text style={styles.duesSub}>{t("home.customerDues")}</Text>
            </TouchableOpacity>

            <View style={styles.duesVerticalDivider} />

            {/* To Pay (Payables) */}
            <TouchableOpacity
              style={styles.duesCol}
              activeOpacity={0.75}
              onPress={() => router.push("/purchases?filter=due")}
              accessibilityRole="button"
              accessibilityLabel={`${t("home.toPay")}: ${summary?.payablesDue ?? 0}`}
            >
              <View style={styles.duesHeader}>
                <View style={[styles.duesIndicator, { backgroundColor: colors.dangerLight }]}>
                  <Feather name="arrow-up-right" size={13} color={colors.danger} />
                </View>
                <Text style={styles.duesLabel}>{t("home.toPay")}</Text>
                <Feather name="chevron-right" size={13} color={colors.textSubtle} style={styles.duesChevron} />
              </View>
              <Text style={[styles.duesAmount, { color: colors.danger }]}>
                {isBalanceVisible
                  ? `- ${formatNpr(summary?.payablesDue ?? 0)}`
                  : "••••••"}
              </Text>
              <Text style={styles.duesSub}>{t("home.supplierDues")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2x4 Quick Action FinTech Grid */}
        <View style={styles.quickGridCard}>
          <View style={styles.quickGridTitleRow}>
            <Text style={styles.quickGridTitle}>{t("home.quickLinks")}</Text>
            <TouchableOpacity onPress={() => setAddTxnOpen(true)} hitSlop={8}>
              <Text style={styles.seeAllActionsText}>{t("home.showAll")}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.gridContainer}>
            {FINTECH_QUICK_ACTIONS.filter((action) => canSee(action.module)).map((action) => (
              <QuickActionTile
                key={action.key}
                action={action}
                label={t(action.labelKey)}
                onPress={() => {
                  if (action.action === "openMore") return setAddTxnOpen(true);
                  return router.push(action.href);
                }}
              />
            ))}
          </View>
        </View>

        {/* Segment Tabs: Transaction Details vs Party Details */}
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segment, tab === "transactionDetails" && styles.segmentActive]}
            onPress={() => {
              setTab("transactionDetails");
              setStatusFilter("all");
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
          >
            <Text style={[styles.segmentText, tab === "transactionDetails" && styles.segmentTextActive]}>
              {t("home.transactionDetails")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, tab === "partyDetails" && styles.segmentActive]}
            onPress={() => {
              setTab("partyDetails");
              setStatusFilter("all");
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
          >
            <Text style={[styles.segmentText, tab === "partyDetails" && styles.segmentTextActive]}>
              {t("home.partyDetails")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchAndFilterBox}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={tab === "transactionDetails" ? t("home.searchTxnPlaceholder") : t("home.searchPartyPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                <Feather name="x-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            {tab === "transactionDetails" ? (
              <>
                <TouchableOpacity
                  style={[styles.chip, statusFilter === "all" && styles.chipActive]}
                  onPress={() => setStatusFilter("all")}
                >
                  <Text style={[styles.chipText, statusFilter === "all" && styles.chipTextActive]}>
                    {t("home.filterAll")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, statusFilter === "unpaid" && styles.chipActive]}
                  onPress={() => setStatusFilter("unpaid")}
                >
                  <Text style={[styles.chipText, statusFilter === "unpaid" && styles.chipTextActive]}>
                    {t("home.filterUnpaid")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, statusFilter === "paid" && styles.chipActive]}
                  onPress={() => setStatusFilter("paid")}
                >
                  <Text style={[styles.chipText, statusFilter === "paid" && styles.chipTextActive]}>
                    {t("home.filterPaid")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.chip, statusFilter === "all" && styles.chipActive]}
                  onPress={() => setStatusFilter("all")}
                >
                  <Text style={[styles.chipText, statusFilter === "all" && styles.chipTextActive]}>
                    {t("home.filterAll")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, statusFilter === "receivable" && styles.chipActive]}
                  onPress={() => setStatusFilter("receivable")}
                >
                  <Text style={[styles.chipText, statusFilter === "receivable" && styles.chipTextActive]}>
                    {t("home.filterReceivable")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, statusFilter === "payable" && styles.chipActive]}
                  onPress={() => setStatusFilter("payable")}
                >
                  <Text style={[styles.chipText, statusFilter === "payable" && styles.chipTextActive]}>
                    {t("home.filterPayable")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>

        {/* List Content */}
        <View style={styles.listSection}>
          {loading ? (
            <SkeletonList rows={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load(false)} />
          ) : tab === "transactionDetails" ? (
            filteredInvoices.length === 0 ? (
              <EmptyState
                icon="file-text"
                title={t("home.noTransactionsTitle")}
                body={t("home.noTransactionsBody")}
                actionLabel={t("home.addNewSale")}
                onAction={() => router.push("/sales/new")}
              />
            ) : (
              filteredInvoices.map((item, index) => (
                <EnhancedTransactionCard
                  key={item.id}
                  item={item}
                  delay={staggerDelay(index)}
                  onPress={() => router.push(`/sales/${item.id}`)}
                  onShare={() => handleShare(item)}
                />
              ))
            )
          ) : filteredParties.length === 0 ? (
            <EmptyState
              icon="users"
              title={t("home.noPartiesTitle")}
              body={t("home.noPartiesBody")}
              actionLabel={t("home.addParty")}
              onAction={() => router.push("/parties/new")}
            />
          ) : (
            filteredParties.map((party, index) => {
              const balance = Number(party.balance ?? 0);
              const isDr = balance >= 0;
              const subtitle = [party.phoneNumber, party.groupName].filter(Boolean).join(" · ");
              const meta = `${formatNpr(Math.abs(balance))} ${isDr ? (isNepali ? "डेबिट" : "Dr") : (isNepali ? "क्रेडिट" : "Cr")}`;

              return (
                <ListRow
                  key={party.id}
                  index={index}
                  title={party.name}
                  subtitle={subtitle}
                  meta={meta}
                  onPress={() => router.push(`/parties/${party.id}`)}
                  style={[
                    styles.partyCard,
                    { borderLeftWidth: 3, borderLeftColor: isDr ? colors.success : colors.danger },
                  ]}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      {canSee("sales") ? (
        <BottomFAB
          bottomOffset={16}
          label={t("home.addNewSale")}
          icon="plus"
          onPress={() => router.push("/sales/new")}
        />
      ) : null}

      {/* More Actions Bottom Sheet Modal */}
      <Modal
        visible={addTxnOpen}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setAddTxnOpen(false)}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setAddTxnOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("home.addTxn")}</Text>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {ADD_TXN_ACTIONS.filter((action) => canSee(action.module)).map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.sheetRow}
                  onPress={() => goToAddTxnAction(action.href)}
                >
                  <View style={[styles.sheetRowIcon, { backgroundColor: action.bg, borderColor: action.border }]}>
                    <MaterialCommunityIcons name={action.icon} size={20} color={action.color} />
                  </View>
                  <Text style={styles.sheetRowLabel}>{t(action.labelKey)}</Text>
                  <Feather name="chevron-right" size={18} color={colors.iconMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  setupPrompt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  setupPromptTitle: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text, textAlign: "center", marginTop: 8 },
  setupPromptBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
  setupPromptButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  setupPromptButtonText: { fontFamily: fonts.semiBold, fontSize: 14, color: "#fff" },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2F2F2F",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: { width: 70, height: 70 },

  // Date banner
  dateBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dateBannerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dateBannerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.primaryDark,
  },
  fyBannerPill: {
    backgroundColor: colors.light,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fyBannerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },

  // FinTech Hero Card
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroMutedTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  heroCashValue: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 0.3,
  },
  eyeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: colors.light,
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 14,
  },
  heroDuesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  duesCol: {
    flex: 1,
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  duesChevron: {
    marginLeft: "auto",
  },
  duesVerticalDivider: {
    width: 1,
    height: 38,
    backgroundColor: colors.borderLight,
    marginHorizontal: 12,
  },
  duesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  duesIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  duesLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  duesAmount: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  duesSub: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSubtle,
  },

  // 2x4 Quick Action Grid
  quickGridCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  quickGridTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  quickGridTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  seeAllActionsText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  quickActionTile: {
    width: "22.5%",
    alignItems: "center",
    gap: 5,
  },
  quickActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  quickActionLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },

  // Segment Tabs
  segmentRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: colors.cardBg,
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  segmentText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primary,
  },

  // Search & Filter Box
  searchAndFilterBox: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },
  filterChipsRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: "#fff",
    fontFamily: fonts.semiBold,
  },

  // List Section
  listSection: {
    paddingHorizontal: 16,
  },

  // Enhanced Txn Card
  txnCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  txnCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  partyAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: tint("primary", 0.1),
    borderWidth: 1,
    borderColor: tint("primary", 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  partyAvatarText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
  },
  txnCardMeta: {
    flex: 1,
  },
  partyTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  txnPartyName: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginRight: 6,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  docSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  docNumber: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  docDot: {
    fontSize: 9,
    color: colors.textSubtle,
  },
  docDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSubtle,
  },
  txnCardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  amountsGroup: {
    flexDirection: "row",
    gap: 16,
  },
  amountItem: {
    gap: 1,
  },
  amountMutedLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSubtle,
  },
  amountStrongVal: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  cardActionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.light,
  },

  partyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Modal Sheet
  sheetBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.text,
    marginBottom: 14,
  },
  sheetScroll: { maxHeight: 420 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sheetRowLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
});
