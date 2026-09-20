import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ExpenseCard({ item, delay = 0 }) {
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const title = item.categoryName || item.description || `#${item.expenseNumber ?? item.id}`;
  const subMeta = [item.expenseNumber ? `#${item.expenseNumber}` : null, item.expenseDate, item.partyName].filter(Boolean).join(" · ");

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPress={() => router.push(`/expenses/${item.id}`)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          {subMeta ? <Text style={styles.meta}>{subMeta}</Text> : null}
        </View>
        <Text style={styles.amount}>{formatNpr(item.amount)}</Text>
      </View>
      {item.paymentMode || item.description ? (
        <View style={styles.cardBottomRow}>
          {item.paymentMode ? (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{String(item.paymentMode).toUpperCase()}</Text>
            </View>
          ) : null}
          {item.description && item.categoryName ? (
            <Text style={styles.descriptionText} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
        </View>
      ) : null}
    </AnimatedTouchable>
  );
}

export default function ExpensesListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState([]);
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
      apiFetch("/api/mobile/expenses")
        .then((data) => {
          if (token !== requestToken.current) return;
          setExpenses(Array.isArray(data) ? data : []);
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

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (exp) =>
        exp.categoryName?.toLowerCase().includes(q) ||
        exp.description?.toLowerCase().includes(q) ||
        exp.partyName?.toLowerCase().includes(q) ||
        String(exp.expenseNumber ?? "").toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const totalExpense = expenses.reduce((sum, exp) => sum + Number(exp.amount ?? 0), 0);
  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("expenses.listTitle", { defaultValue: "Expenses" })} />

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t("expenses.totalExpenses", { defaultValue: "Total Expenses" })}</Text>
        <Text style={styles.summaryValue}>{formatNpr(totalExpense)}</Text>
      </View>

      {/* Search Toolbar */}
      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("expenses.searchPlaceholder", { defaultValue: "Search category, note, party..." })}
        />
      </View>

      {loading ? (
        <View style={[styles.listContent, { paddingBottom: listPaddingBottom }]}>
          <SkeletonList rows={7} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(expense) => String(expense.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="credit-card" title={t("expenses.noExpensesTitle")} body={t("expenses.noExpensesBody")} />}
          renderItem={({ item, index }) => <ExpenseCard item={item} delay={staggerDelay(index)} />}
        />
      )}

      <BottomFAB
        label={t("expenses.createTitle", { defaultValue: "+ Add Expense" })}
        icon="plus"
        onPress={() => router.push("/expenses/new")}
      />
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
  listContent: {
    paddingHorizontal: 16,
  },
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
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.danger,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  modeBadge: {
    backgroundColor: `${colors.primary}12`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  descriptionText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
});
