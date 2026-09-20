import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Share } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr, countsTowardTotals } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import TransactionCard from "../components/ui/TransactionCard";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { staggerDelay } from "../lib/useFadeInUp";

export default function SaleListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { filter } = useLocalSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      apiFetch("/api/mobile/sales-invoices")
        .then((data) => {
          if (token !== requestToken.current) return;
          setInvoices(Array.isArray(data) ? data : []);
          setError(null);
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

  const totalSale = invoices.filter(countsTowardTotals).reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);

  const baseInvoices = filter === "due"
    ? invoices.filter((inv) => Number(inv.dueAmount) > 0 && inv.status !== "cancelled")
    : invoices;

  const filteredInvoices = search.trim()
    ? baseInvoices.filter(
        (inv) =>
          inv.partyName?.toLowerCase().includes(search.toLowerCase()) ||
          String(inv.invoiceNumber).includes(search),
      )
    : baseInvoices;

  function handleShare(item) {
    const text = `Sale Invoice #${item.invoiceNumber}\nParty: ${item.partyName || "Cash"}\nAmount: ${formatNpr(item.totalAmount)}\nBalance Due: ${formatNpr(item.dueAmount)}`;
    Share.share({ message: text });
  }

  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("sale.listTitle", "Sale list")}
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setSearchOpen((prev) => !prev)}
              accessibilityLabel="Search sales"
            >
              <Feather name="search" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pdfBadge}
              onPress={() => router.push("/sales/report")}
              accessibilityLabel="Export PDF"
            >
              <Text style={styles.pdfBadgeText}>Pdf</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t("sale.totalSale", "Total Sale")}</Text>
        <Text style={styles.summaryValue}>{formatNpr(totalSale)}</Text>
      </View>

      {searchOpen ? (
        <View style={styles.searchWrap}>
          <SearchToolbar
            value={search}
            onChangeText={setSearch}
            placeholder={t("sale.searchPlaceholder", "Search party or invoice #...")}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.listContent, { paddingBottom: listPaddingBottom }]}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(inv) => String(inv.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="file-text"
              title={t("sale.noSalesTitle", "No sales recorded yet")}
              body={t("sale.noSalesBody", "Tap below to create your first sale invoice.")}
            />
          }
          renderItem={({ item, index }) => {
            const isCancelled = item.status === "cancelled";
            const isPartial = Number(item.dueAmount) > 0 && Number(item.dueAmount) < Number(item.totalAmount);
            const badgeTone = isCancelled ? "danger" : isPartial ? "info" : "success";
            const badgeText = isCancelled ? "CANCELLED" : isPartial ? "PARTIAL" : "SALE";

            return (
              <TransactionCard
                partyName={item.partyName}
                documentNumber={item.invoiceNumber}
                documentDate={item.invoiceDate}
                badgeText={badgeText}
                badgeTone={badgeTone}
                totalAmount={item.totalAmount}
                balanceAmount={item.dueAmount}
                delay={staggerDelay(index)}
                onPress={() => router.push(`/sales/${item.id}`)}
                onPrint={() => router.push(`/sales/${item.id}`)}
                onShare={() => handleShare(item)}
                onMore={() => router.push(`/sales/${item.id}`)}
              />
            );
          }}
        />
      )}

      <BottomFAB
        label={t("home.addNewSale", "+ Add Sale")}
        icon="plus"
        onPress={() => router.push("/sales/new")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    padding: 4,
  },
  pdfBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pdfBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.text,
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
  },
});
