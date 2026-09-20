import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
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

function PaymentCard({ item, paymentType, delay = 0 }) {
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const isIn = paymentType === "in";
  const num = item.receiptNumber ? `#${item.receiptNumber}` : `#${item.id}`;
  const party = item.partyName || "—";
  const meta = [item.bankLabel, item.paymentDate].filter(Boolean).join(" · ");

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${num} ${party}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.partyWrap}>
          <Text style={styles.partyName} numberOfLines={1}>
            {party}
          </Text>
          <Text style={styles.receiptNum}>{num}</Text>
        </View>
        <Text style={[styles.amount, isIn ? styles.amountIn : styles.amountOut]}>
          {isIn ? "+" : "-"} {formatNpr(item.amount)}
        </Text>
      </View>

      <View style={styles.cardBottom}>
        <View style={[styles.typePill, isIn ? styles.typePillIn : styles.typePillOut]}>
          <Text style={[styles.typePillText, isIn ? styles.typeTextIn : styles.typeTextOut]}>
            {isIn ? "PAYMENT IN" : "PAYMENT OUT"}
          </Text>
        </View>
        {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
      </View>
    </AnimatedTouchable>
  );
}

export default function PaymentsListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams();
  const paymentType = type === "out" ? "out" : "in";
  const [payments, setPayments] = useState([]);
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
      apiFetch(`/api/mobile/payments?type=${paymentType}`)
        .then((data) => {
          if (token !== requestToken.current) return;
          setPayments(Array.isArray(data) ? data : []);
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
    [paymentType, t],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.partyName?.toLowerCase().includes(q) ||
        p.bankLabel?.toLowerCase().includes(q) ||
        String(p.receiptNumber ?? "").toLowerCase().includes(q) ||
        String(p.id ?? "").toLowerCase().includes(q),
    );
  }, [payments, search]);

  const total = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const title = paymentType === "in" ? t("cashBank.paymentInTitle", { defaultValue: "Payment In" }) : t("cashBank.paymentOutTitle", { defaultValue: "Payment Out" });
  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={title} />

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{title}</Text>
        <Text style={styles.summaryValue}>{formatNpr(total)}</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("cashBank.searchPayments", { defaultValue: "Search party, receipt #..." })}
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
          data={filteredPayments}
          keyExtractor={(payment) => String(payment.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="credit-card" title={t("cashBank.noPaymentsTitle", { defaultValue: "No payments yet" })} body={t("cashBank.noPaymentsBody", { defaultValue: "Payments will show here." })} />}
          renderItem={({ item, index }) => <PaymentCard item={item} paymentType={paymentType} delay={staggerDelay(index)} />}
        />
      )}

      <BottomFAB
        label={paymentType === "in" ? t("cashBank.addPaymentIn", { defaultValue: "+ Add Payment In" }) : t("cashBank.addPaymentOut", { defaultValue: "+ Add Payment Out" })}
        icon="plus"
        onPress={() => router.push({ pathname: "/payments/new", params: { type: paymentType } })}
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
  listContent: { paddingHorizontal: 16 },
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  partyWrap: {
    flex: 1,
    gap: 2,
  },
  partyName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  receiptNum: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  amountIn: {
    color: colors.success,
  },
  amountOut: {
    color: colors.danger,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  typePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillIn: {
    backgroundColor: `${colors.success}15`,
  },
  typePillOut: {
    backgroundColor: `${colors.danger}15`,
  },
  typePillText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  typeTextIn: {
    color: colors.success,
  },
  typeTextOut: {
    color: colors.danger,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});

