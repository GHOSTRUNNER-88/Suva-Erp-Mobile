import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function TransferCard({ item, t }) {
  const press = usePressScale();

  return (
    <AnimatedTouchable
      style={[styles.card, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconSquircle}>
          <MaterialCommunityIcons name="bank-transfer" size={24} color="#7C3AED" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.reference}>{item.reference || `#${item.id}`}</Text>
          <Text style={styles.date}>{item.date ? String(item.date).slice(0, 10) : "-"}</Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amount}>{formatNpr(item.amount)}</Text>
        </View>
      </View>

      <View style={styles.transferFlowBox}>
        <View style={styles.flowNode}>
          <Text style={styles.flowLabel}>{t("cashTransfers.from", { defaultValue: "From" })}</Text>
          <Text style={styles.bankName} numberOfLines={1}>
            {item.displayName || item.bankName || "-"}
          </Text>
        </View>

        <View style={styles.flowArrowContainer}>
          <Feather name="arrow-right" size={16} color={colors.primary} />
        </View>

        <View style={styles.flowNode}>
          <Text style={styles.flowLabel}>{t("cashTransfers.to", { defaultValue: "To" })}</Text>
          <Text style={styles.bankName} numberOfLines={1}>
            {item.toDisplayName || item.toBankName || "-"}
          </Text>
        </View>
      </View>

      {item.note ? (
        <View style={styles.footerRow}>
          <Feather name="message-square" size={12} color={colors.textMuted} />
          <Text style={styles.note} numberOfLines={1}>
            {item.note}
          </Text>
        </View>
      ) : null}
    </AnimatedTouchable>
  );
}

export default function CashTransfersListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [transfers, setTransfers] = useState([]);
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
      apiFetch("/api/mobile/cash-transfers")
        .then((data) => {
          if (token !== requestToken.current) return;
          setTransfers(Array.isArray(data) ? data : []);
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

  const filtered = transfers.filter((item) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [
      item.reference,
      item.displayName,
      item.bankName,
      item.toDisplayName,
      item.toBankName,
      item.note,
      String(item.amount),
    ].some((field) => String(field ?? "").toLowerCase().includes(q));
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("cashTransfers.title", { defaultValue: "Cash & Bank Transfers" })} />

      <View style={styles.searchContainer}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("cashTransfers.searchPlaceholder", { defaultValue: "Search transfers, accounts..." })}
        />
      </View>

      {loading ? (
        <View style={styles.content}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 84, 96) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="repeat"
              title={t("cashTransfers.empty", { defaultValue: "No transfers yet" })}
              body={t("cashTransfers.emptyBody", { defaultValue: "Record money moved between cash drawers and bank accounts." })}
            />
          }
          renderItem={({ item }) => <TransferCard item={item} t={t} />}
        />
      )}

      <BottomFAB
        label={t("cashTransfers.newTransfer", { defaultValue: "New Transfer" })}
        icon="plus"
        onPress={() => router.push("/cash-transfers/new")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  content: { padding: 16, gap: 10 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: { flex: 1 },
  reference: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  amountCol: { alignItems: "flex-end" },
  amount: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  transferFlowBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bodyBg,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  flowNode: { flex: 1 },
  flowLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, textTransform: "uppercase" },
  bankName: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginTop: 2 },
  flowArrowContainer: {
    paddingHorizontal: 8,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  note: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});