import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import { dealStageColor } from "../lib/dealStageColor";
import ScreenHeader from "../components/ui/ScreenHeader";
import ListRow from "../components/ui/ListRow";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { staggerDelay } from "../lib/useFadeInUp";

export default function DealsListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      apiFetch("/api/mobile/deals")
        .then((data) => {
          if (token !== requestToken.current) return;
          setDeals(Array.isArray(data) ? data : []);
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

  const pipelineValue = deals.filter((deal) => deal.stage !== "Lost").reduce((sum, deal) => sum + Number(deal.expectedRevenue ?? 0), 0);
  const listPaddingBottom = Math.max(insets.bottom + 96, 104);

  function renderDealBadge(stage) {
    if (!stage) return null;
    const color = dealStageColor(stage);
    return (
      <View style={[styles.stageBadge, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
        <Text style={[styles.stageBadgeText, { color }]}>{t(`crm.stage${stage}`, stage)}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("crm.listTitle")}
        right={
          <View style={styles.headerRight}>
            <View style={styles.pipelinePill}>
              <Text style={styles.pipelineLabel}>{t("crm.pipelineValue", { defaultValue: "Pipeline" })}</Text>
              <Text style={styles.pipelineValue}>{formatNpr(pipelineValue)}</Text>
            </View>
          </View>
        }
      />

      {loading ? (
        <View style={[styles.listContent, { paddingBottom: listPaddingBottom }]}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(deal) => String(deal.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="target" title={t("crm.noDealsTitle")} body={t("crm.noDealsBody")} />}
          renderItem={({ item, index }) => (
            <ListRow
              index={index}
              title={item.title}
              subtitle={[item.partyName, item.expectedRevenue ? formatNpr(item.expectedRevenue) : null].filter(Boolean).join(" · ")}
              badge={renderDealBadge(item.stage)}
              onPress={() => router.push(`/deals/${item.id}`)}
              style={styles.dealRow}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push("/deals/new")}
        accessibilityRole="button"
        accessibilityLabel={t("crm.createTitle")}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>{t("crm.createTitle")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  pipelinePill: {
    backgroundColor: colors.cardBg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  pipelineLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  pipelineValue: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  listContent: { paddingHorizontal: 16 },
  dealRow: { paddingVertical: 14 },
  stageBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  stageBadgeText: { fontFamily: fonts.semiBold, fontSize: 10 },
  fab: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fabText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 14 },
});
