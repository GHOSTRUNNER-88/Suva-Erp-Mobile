import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import StatusBadge from "../components/ui/StatusBadge";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ChequeCard({ item, delay = 0 }) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const isReceived = item.chequeType === "received";
  const date = item.chequeDate ? String(item.chequeDate).slice(0, 10) : String(item.createdAt || "").slice(0, 10);

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Cheque #${item.chequeNumber}`}
    >
      <View style={styles.topRow}>
        <View style={styles.partyWrap}>
          <Text style={styles.partyName} numberOfLines={1}>
            {item.partyName || item.bankName || "—"}
          </Text>
          <Text style={styles.chequeNum}>#{item.chequeNumber}</Text>
        </View>
        <Text style={styles.amount}>{formatNpr(item.amount)}</Text>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.metaLeft}>
          <View style={[styles.typeBadge, isReceived ? styles.badgeReceived : styles.badgeIssued]}>
            <Text style={[styles.typeBadgeText, isReceived ? styles.textReceived : styles.textIssued]}>
              {isReceived ? t("cheques.receivedTag", "RECEIVED") : t("cheques.issuedTag", "ISSUED")}
            </Text>
          </View>
          {item.status ? <StatusBadge status={item.status} /> : null}
        </View>
        <Text style={styles.dateText}>{date}</Text>
      </View>
    </AnimatedTouchable>
  );
}

export default function ChequesListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [cheques, setCheques] = useState([]);
  const [filter, setFilter] = useState("all"); // "all" | "received" | "issued"
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
      apiFetch("/api/mobile/cheques")
        .then((data) => {
          if (token !== requestToken.current) return;
          setCheques(Array.isArray(data) ? data : []);
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
    return cheques.filter((c) => {
      if (filter === "received" && c.chequeType !== "received") return false;
      if (filter === "issued" && c.chequeType !== "issued") return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        String(c.chequeNumber ?? "").toLowerCase().includes(q) ||
        String(c.partyName ?? "").toLowerCase().includes(q) ||
        String(c.bankName ?? "").toLowerCase().includes(q)
      );
    });
  }, [cheques, filter, search]);

  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("cheques.title", { defaultValue: "Cheques Register" })} />

      <View style={styles.tabsRow}>
        {["all", "received", "issued"].map((tab) => {
          const active = filter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setFilter(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                {tab === "all"
                  ? t("common.all", { defaultValue: "All" })
                  : tab === "received"
                  ? t("cheques.receivedTab", { defaultValue: "Received" })
                  : t("cheques.issuedTab", { defaultValue: "Issued" })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("cheques.searchPlaceholder", { defaultValue: "Search cheque #, party, bank..." })}
        />
      </View>

      {loading ? (
        <View style={[styles.content, { paddingBottom: listPaddingBottom }]}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="file-text" title={t("cheques.empty", { defaultValue: "No cheques found" })} />}
          renderItem={({ item, index }) => <ChequeCard item={item} delay={staggerDelay(index)} />}
        />
      )}

      <BottomFAB
        label={t("cheques.newCheque", { defaultValue: "+ Add Cheque" })}
        icon="plus"
        onPress={() => router.push("/cheques/new")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  tabChipTextActive: {
    color: "#fff",
    fontFamily: fonts.semiBold,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  content: { padding: 16 },
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
  chequeNum: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeReceived: {
    backgroundColor: `${colors.success}15`,
  },
  badgeIssued: {
    backgroundColor: `${colors.warning}18`,
  },
  typeBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  textReceived: {
    color: colors.success,
  },
  textIssued: {
    color: "#B47300",
  },
  dateText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});