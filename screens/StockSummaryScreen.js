import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function StockCard({ item, delay = 0 }) {
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const stock = Number(item.stockQuantity ?? 0);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;
  const badgeBg = isOutOfStock ? `${colors.danger}15` : isLowStock ? `${colors.warning}20` : `${colors.success}15`;
  const badgeColor = isOutOfStock ? colors.danger : isLowStock ? "#B47300" : colors.success;

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPress={() => router.push(`/items/${item.id}`)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          {item.categoryName ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.categoryName.toUpperCase()}</Text>
            </View>
          ) : null}
          {item.barcodeValue ? <Text style={styles.barcodeText}>#{item.barcodeValue}</Text> : null}
        </View>
      </View>

      <View style={[styles.stockPill, { backgroundColor: badgeBg }]}>
        <Text style={[styles.stockValue, { color: badgeColor }]}>
          {item.stockQuantity ?? 0} {item.primaryUnitCode ?? ""}
        </Text>
      </View>
    </AnimatedTouchable>
  );
}

export default function StockSummaryScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
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
      setError(null);
      apiFetch("/api/mobile/items")
        .then((data) => {
          if (token !== requestToken.current) return;
          setItems(Array.isArray(data) ? data : []);
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

  const filteredAndSorted = useMemo(() => {
    let result = items;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.categoryName?.toLowerCase().includes(q) ||
          item.barcodeValue?.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => Number(a.stockQuantity ?? 0) - Number(b.stockQuantity ?? 0));
  }, [items, search]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("items.stockSummary", { defaultValue: "Stock Summary" })} />

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("items.searchPlaceholder", { defaultValue: "Search item, category, barcode..." })}
        />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <SkeletonList rows={8} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filteredAndSorted}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="package" title={t("items.noItemsTitle", { defaultValue: "No items found" })} body={t("items.noItemsBody", { defaultValue: "Add products or stock to view your summary." })} />}
          renderItem={({ item, index }) => <StockCard item={item} delay={staggerDelay(index)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 8,
  },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLeft: { flex: 1, marginRight: 12, gap: 4 },
  itemName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryBadge: {
    backgroundColor: colors.light,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  barcodeText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  stockPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stockValue: { fontFamily: fonts.semiBold, fontSize: 14 },
});

