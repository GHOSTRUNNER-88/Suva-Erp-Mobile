import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import StatusBadge from "../components/ui/StatusBadge";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function BankCard({ item, delay = 0 }) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const balance = Number(item.currentBalance ?? 0);
  const negative = balance < 0;

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${item.bankName} ${item.displayName || ""}`}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBadge}>
          <Feather name="briefcase" size={18} color={colors.primary} />
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.bankName} numberOfLines={1}>
            {item.bankName}
          </Text>
          {item.displayName ? (
            <Text style={styles.displayName} numberOfLines={1}>
              {item.displayName}
            </Text>
          ) : null}
          {item.accountNumber ? (
            <Text style={styles.accountNumber} numberOfLines={1}>
              A/C: {item.accountNumber}
            </Text>
          ) : null}
        </View>
        <StatusBadge
          status={item.status === "active" ? "active" : "inactive"}
          label={item.status === "active" ? t("cashBank.statusActive", "Active") : t("cashBank.statusInactive", "Inactive")}
        />
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>{t("cashBank.currentBalance", { defaultValue: "Current Balance" })}</Text>
        <Text style={[styles.balance, negative && styles.balanceNegative]}>{formatNpr(balance)}</Text>
      </View>
    </AnimatedTouchable>
  );
}

export default function BankAccountsScreen() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      apiFetch("/api/mobile/bank-accounts")
        .then((data) => {
          if (token !== requestToken.current) return;
          setAccounts(Array.isArray(data) ? data : []);
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

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.bankName?.toLowerCase().includes(q) ||
        a.displayName?.toLowerCase().includes(q) ||
        a.accountNumber?.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("cashBank.bankAccountsTitle", { defaultValue: "Bank Accounts" })} />

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t("cashBank.totalBankBalance", { defaultValue: "Total Bank Balance" })}</Text>
        <Text style={styles.summaryValue}>{formatNpr(totalBalance)}</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("cashBank.searchPlaceholder", { defaultValue: "Search bank, account name..." })}
        />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <SkeletonList rows={5} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(account) => String(account.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="briefcase" title={t("cashBank.noAccountsTitle", { defaultValue: "No bank accounts" })} body={t("cashBank.noAccountsBody", { defaultValue: "Bank accounts will show here." })} />}
          renderItem={({ item, index }) => <BankCard item={item} delay={staggerDelay(index)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
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
    marginBottom: 10,
  },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${colors.primary}12`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  nameBlock: { flex: 1, marginRight: 8, gap: 2 },
  bankName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  displayName: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  accountNumber: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSubtle, marginTop: 1 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  balance: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  balanceNegative: { color: colors.danger },
});

