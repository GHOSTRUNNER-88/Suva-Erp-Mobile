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
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PartyDueCard({ item, t }) {
  const press = usePressScale();
  const initial = (item.partyName || "P").charAt(0).toUpperCase();

  return (
    <AnimatedTouchable
      style={[styles.card, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => router.push(`/parties/${item.partyId}`)}
      accessibilityRole="button"
      accessibilityLabel={item.partyName}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.avatarSquircle}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
        <View style={styles.partyInfo}>
          <Text style={styles.partyName} numberOfLines={1}>
            {item.partyName}
          </Text>
          <Text style={styles.partyType}>{item.partyType || "Customer"}</Text>
        </View>
        <View style={styles.dueCol}>
          <Text style={styles.partyDue}>{formatNpr(item.totalDue || 0)}</Text>
          <Text style={styles.dueSubtext}>{t("parties.dueLabel", { defaultValue: "Overdue" })}</Text>
        </View>
      </View>

      <View style={styles.ageingBreakdown}>
        {Number(item.current || 0) > 0 ? (
          <View style={[styles.ageingBadge, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Text style={[styles.ageingText, { color: colors.success }]}>Current: {formatNpr(item.current)}</Text>
          </View>
        ) : null}
        {Number(item.days1to30 || 0) > 0 ? (
          <View style={[styles.ageingBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
            <Text style={[styles.ageingText, { color: "#D97706" }]}>1-30d: {formatNpr(item.days1to30)}</Text>
          </View>
        ) : null}
        {Number(item.days31to60 || 0) > 0 ? (
          <View style={[styles.ageingBadge, { backgroundColor: "#FFEDD5", borderColor: "#FED7AA" }]}>
            <Text style={[styles.ageingText, { color: "#EA580C" }]}>31-60d: {formatNpr(item.days31to60)}</Text>
          </View>
        ) : null}
        {Number(item.over90 || 0) > 0 ? (
          <View style={[styles.ageingBadge, { backgroundColor: "#FEE2E2", borderColor: "#FECDD3" }]}>
            <Text style={[styles.ageingText, { color: colors.danger }]}>90d+: {formatNpr(item.over90)}</Text>
          </View>
        ) : null}
      </View>
    </AnimatedTouchable>
  );
}

export default function PartyDuesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [duesData, setDuesData] = useState({ rows: [], totals: null });
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
      apiFetch("/api/mobile/parties/dues")
        .then((res) => {
          if (token !== requestToken.current) return;
          const data = res?.data || res;
          setDuesData({
            rows: Array.isArray(data?.rows) ? data.rows : [],
            totals: data?.totals ?? null,
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

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const { rows, totals } = duesData;

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.partyName, r.partyType].some((field) => String(field ?? "").toLowerCase().includes(q));
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("parties.duesTitle", { defaultValue: "Party Dues & Receivables" })} />

      <View style={styles.searchContainer}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("parties.searchDuesPlaceholder", { defaultValue: "Search parties with dues..." })}
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
          data={filteredRows}
          keyExtractor={(item) => String(item.partyId)}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            totals ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t("parties.totalDues", { defaultValue: "Total Outstanding Receivables" })}</Text>
                <Text style={styles.summaryAmount}>{formatNpr(totals.totalDue || 0)}</Text>
                <View style={styles.bucketsRow}>
                  <View style={styles.bucketCol}>
                    <Text style={styles.bucketLabel}>Current</Text>
                    <Text style={styles.bucketVal}>{formatNpr(totals.current || 0)}</Text>
                  </View>
                  <View style={styles.bucketCol}>
                    <Text style={styles.bucketLabel}>1-30d</Text>
                    <Text style={styles.bucketVal}>{formatNpr(totals.days1to30 || 0)}</Text>
                  </View>
                  <View style={styles.bucketCol}>
                    <Text style={styles.bucketLabel}>31-60d</Text>
                    <Text style={styles.bucketVal}>{formatNpr(totals.days31to60 || 0)}</Text>
                  </View>
                  <View style={styles.bucketCol}>
                    <Text style={styles.bucketLabel}>60d+</Text>
                    <Text style={styles.bucketVal}>{formatNpr(Number(totals.days61to90 || 0) + Number(totals.over90 || 0))}</Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="users" title={t("parties.noDues", { defaultValue: "No outstanding dues found" })} />}
          renderItem={({ item }) => <PartyDueCard item={item} t={t} />}
        />
      )}
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
  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  summaryAmount: { fontFamily: fonts.bold, fontSize: 24, color: colors.danger, marginTop: 4, marginBottom: 14 },
  bucketsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 12,
  },
  bucketCol: { alignItems: "center" },
  bucketLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  bucketVal: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginTop: 2 },
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
  avatarSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.danger,
  },
  partyInfo: { flex: 1 },
  partyName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  partyType: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dueCol: { alignItems: "flex-end" },
  partyDue: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.danger },
  dueSubtext: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  ageingBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  ageingBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ageingText: { fontFamily: fonts.medium, fontSize: 11 },
});