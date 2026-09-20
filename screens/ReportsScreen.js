import { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const REPORTS = [
  { slug: "sales-summary", key: "salesSummary", icon: "bar-chart-2", color: "#3B82F6", bg: "#EFF6FF" },
  { slug: "sales-register", key: "salesRegister", icon: "file-text", color: "#10B981", bg: "#ECFDF5" },
  { slug: "purchase-register", key: "purchaseRegister", icon: "shopping-cart", color: "#8B5CF6", bg: "#F5F3FF" },
  { slug: "vat-summary", key: "vatSummary", icon: "percent", color: "#0D9488", bg: "#CCFBF1" },
  { slug: "profit-loss", key: "profitLoss", icon: "trending-up", color: "#16A34A", bg: "#DCFCE7" },
  { slug: "balance-sheet", key: "balanceSheet", icon: "layers", color: "#6366F1", bg: "#EDE9FE" },
  { slug: "trial-balance", key: "trialBalance", icon: "scale", color: "#7C3AED", bg: "#F5F3FF" },
  { slug: "customer-ageing", key: "customerAgeing", icon: "clock", color: "#F59E0B", bg: "#FFFBEB" },
  { slug: "supplier-ageing", key: "supplierAgeing", icon: "credit-card", color: "#EC4899", bg: "#FDF2F8" },
  { slug: "inventory-summary", key: "inventorySummary", icon: "archive", color: "#6366F1", bg: "#EEF2FF" },
  { slug: "low-stock", key: "lowStock", icon: "alert-triangle", color: "#EF4444", bg: "#FEF2F2" },
  { slug: "day-book", key: "dayBook", icon: "book-open", color: "#0284C7", bg: "#E0F2FE" },
  { slug: "bank-statement", key: "bankStatement", icon: "dollar-sign", color: "#D97706", bg: "#FEF3C7" },
];

function ReportCard({ item, delay = 0 }) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const title = t(`reports.${item.key}`, { defaultValue: item.key });

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      onPress={() => router.push({ pathname: `/reports/${item.slug}` })}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
        <Feather name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{t("reports.tapToView", { defaultValue: "Tap to generate report" })}</Text>
      </View>
      <View style={styles.arrowCircle}>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </AnimatedTouchable>
  );
}

export default function ReportsScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return REPORTS;
    return REPORTS.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q) ||
        t(`reports.${r.key}`, { defaultValue: r.key }).toLowerCase().includes(q),
    );
  }, [search, t]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("reports.title", { defaultValue: "Reports" })} />

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("reports.searchPlaceholder", { defaultValue: "Search reports..." })}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => <ReportCard item={item} delay={staggerDelay(index)} />}
      />
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
  content: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: "row",
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  info: { flex: 1 },
  title: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bodyBg,
    alignItems: "center",
    justifyContent: "center",
  },
});

