import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

function WooOrderCard({ item, delay = 0 }) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const customer = item.customerName || item.partyName || "—";
  const orderNum = item.wooOrderNumber ? `#${item.wooOrderNumber}` : null;
  const itemsText = item.lineCount != null ? `${item.lineCount} ${t("woo.items", { defaultValue: "items" })}` : null;
  const metaText = [orderNum, itemsText].filter(Boolean).join(" · ");

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Order ${orderNum ?? ""} ${customer}`}
    >
      <View style={styles.topRow}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customer}
          </Text>
          {metaText ? <Text style={styles.orderMeta}>{metaText}</Text> : null}
        </View>
        <StatusBadge status={item.wooStatus || "pending"} label={item.wooStatus} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.iconWrap}>
          <Feather name="shopping-bag" size={14} color={colors.primary} />
          <Text style={styles.sourceText}>WooCommerce</Text>
        </View>
        <Text style={styles.orderTotal}>{formatNpr(item.orderTotal)}</Text>
      </View>
    </AnimatedTouchable>
  );
}

export default function WooCommerceOrdersScreen() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
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
      apiFetch("/api/mobile/woocommerce/orders")
        .then((data) => {
          if (token !== requestToken.current) return;
          setOrders(Array.isArray(data?.rows) ? data.rows : []);
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

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        String(o.customerName ?? "").toLowerCase().includes(q) ||
        String(o.partyName ?? "").toLowerCase().includes(q) ||
        String(o.wooOrderNumber ?? "").toLowerCase().includes(q),
    );
  }, [orders, search]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("menu.wooOrders", { defaultValue: "WooCommerce Orders" })} />

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("woo.searchPlaceholder", { defaultValue: "Search customer, order #..." })}
        />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item, index) => String(item?.id ?? index)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="shopping-bag" title={t("woo.noOrdersTitle", { defaultValue: "No orders found" })} />}
          renderItem={({ item, index }) => <WooOrderCard item={item} delay={staggerDelay(index)} />}
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
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  customerInfo: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  orderMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  iconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourceText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  orderTotal: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
});

