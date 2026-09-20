import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Share } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr, countsTowardTotals } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import TransactionCard from "../components/ui/TransactionCard";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { staggerDelay } from "../lib/useFadeInUp";

export default function PurchaseListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { filter } = useLocalSearchParams();
  const [bills, setBills] = useState([]);
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
      apiFetch("/api/mobile/purchase-bills")
        .then((data) => {
          if (token !== requestToken.current) return;
          setBills(Array.isArray(data) ? data : []);
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

  const totalPurchase = bills.filter(countsTowardTotals).reduce((sum, bill) => sum + Number(bill.totalAmount ?? 0), 0);

  const baseBills = filter === "due"
    ? bills.filter((b) => Number(b.dueAmount) > 0 && b.status !== "cancelled")
    : bills;

  const filteredBills = search.trim()
    ? baseBills.filter(
        (b) =>
          b.partyName?.toLowerCase().includes(search.toLowerCase()) ||
          String(b.billNumber).includes(search),
      )
    : baseBills;

  function handleShare(item) {
    const text = `Purchase Bill #${item.billNumber}\nSupplier: ${item.partyName || "Cash"}\nAmount: ${formatNpr(item.totalAmount)}\nBalance Due: ${formatNpr(item.dueAmount)}`;
    Share.share({ message: text });
  }

  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("purchase.listTitle", "Purchase list")}
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setSearchOpen((prev) => !prev)}
              accessibilityLabel="Search purchases"
            >
              <Feather name="search" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t("purchase.totalPurchase", "Total Purchase")}</Text>
        <Text style={styles.summaryValue}>{formatNpr(totalPurchase)}</Text>
      </View>

      {searchOpen ? (
        <View style={styles.searchWrap}>
          <SearchToolbar
            value={search}
            onChangeText={setSearch}
            placeholder={t("purchase.searchPlaceholder", "Search supplier or bill #...")}
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
          data={filteredBills}
          keyExtractor={(bill) => String(bill.id)}
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
              icon="shopping-bag"
              title={t("purchase.noPurchasesTitle", "No purchases yet")}
              body={t("purchase.noPurchasesBody", "Purchase bills you record will appear here.")}
            />
          }
          renderItem={({ item, index }) => {
            const isCancelled = item.status === "cancelled";
            const isPartial = Number(item.dueAmount) > 0 && Number(item.dueAmount) < Number(item.totalAmount);
            const badgeTone = isCancelled ? "danger" : isPartial ? "warning" : "info";
            const badgeText = isCancelled ? "CANCELLED" : isPartial ? "PARTIAL" : "BILL";

            return (
              <TransactionCard
                partyName={item.partyName}
                documentNumber={item.billNumber}
                documentDate={item.billDate}
                badgeText={badgeText}
                badgeTone={badgeTone}
                totalAmount={item.totalAmount}
                balanceAmount={item.dueAmount}
                delay={staggerDelay(index)}
                onPress={() => router.push(`/purchases/${item.id}`)}
                onPrint={() => router.push(`/purchases/${item.id}`)}
                onShare={() => handleShare(item)}
                onMore={() => router.push(`/purchases/${item.id}`)}
              />
            );
          }}
        />
      )}

      <BottomFAB
        label={t("purchase.createTitle", "+ Add Purchase")}
        icon="plus"
        onPress={() => router.push("/purchases/new")}
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
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
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
  listContent: {
    paddingHorizontal: 16,
  },
});
