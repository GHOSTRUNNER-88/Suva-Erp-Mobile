import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import StatusBadge from "../components/ui/StatusBadge";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const MODULE_ICONS = {
  sales: "shopping-cart",
  purchases: "truck",
  inventory: "box",
  accounting: "file-text",
  crm: "users",
  hr: "user-check",
  pos: "credit-card",
  manufacturing: "tool",
  woocommerce: "shopping-bag",
};

function ModuleCard({ item, delay = 0 }) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const iconName = MODULE_ICONS[item.key] || "grid";
  const name = t(item.labelKey, { defaultValue: item.key });
  const status = item.enabled ? "active" : item.purchased ? "inactive" : "pending";
  const statusText = item.enabled ? t("modules.active", "Active") : item.purchased ? t("modules.notEnabled", "Available") : t("modules.notPurchased", "Locked");

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.cardMain}>
        <View style={[styles.iconBadge, item.enabled && styles.iconBadgeActive]}>
          <Feather name={iconName} size={20} color={item.enabled ? colors.primary : colors.textMuted} />
        </View>
        <View style={styles.info}>
          <Text style={styles.moduleName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.moduleKey}>{item.key}</Text>
        </View>
        <StatusBadge status={status} label={statusText} />
      </View>
    </AnimatedTouchable>
  );
}

export default function ModulesScreen() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
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
      apiFetch("/api/mobile/modules")
        .then((data) => {
          if (token !== requestToken.current) return;
          setModules(Array.isArray(data) ? data : []);
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

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        String(m.key ?? "").toLowerCase().includes(q) ||
        String(m.labelKey ?? "").toLowerCase().includes(q) ||
        t(m.labelKey, { defaultValue: m.key }).toLowerCase().includes(q),
    );
  }, [modules, search, t]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("menu.modules", { defaultValue: "Modules" })} />

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("modules.searchPlaceholder", { defaultValue: "Search modules..." })}
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
          data={filteredModules}
          keyExtractor={(item, index) => String(item?.key ?? index)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="box" title={t("menu.modules", { defaultValue: "No modules found" })} />}
          renderItem={({ item, index }) => <ModuleCard item={item} delay={staggerDelay(index)} />}
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
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bodyBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconBadgeActive: {
    backgroundColor: `${colors.primary}14`,
  },
  info: {
    flex: 1,
    marginRight: 10,
  },
  moduleName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  moduleKey: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});

