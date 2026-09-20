import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useModuleAccess } from "../lib/orgSession";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Share, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { useOfflineData } from "../lib/offline/hooks";
import { formatNpr, formatNumber } from "../lib/format";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import AppHeader from "../components/ui/AppHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale, useFadeInUp, staggerDelay } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const QUICK_LINKS = [
  { key: "onlineStore", module: "woocommerce", icon: "storefront-outline", href: "/store/woocommerce-orders", bg: "#CCFBF1", border: "#99F6E4", color: "#0D9488" },
  { key: "stockSummary", icon: "package-variant-closed", href: "/items/stock-summary", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "itemSettings", icon: "tune-variant", href: "/business-profile", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
  { key: "showAll", icon: "view-grid-outline", href: "/items/stock-summary", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
];

function ItemCardRow({ item, delay = 0, onShare }) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnimation = useFadeInUp(delay);

  const stockQty = Number(item.stockQuantity ?? 0);
  const inStockColor = stockQty > 0 ? colors.success : colors.danger;

  return (
    <AnimatedTouchable
      style={[styles.itemCard, enterAnimation, press.style]}
      activeOpacity={0.88}
      onPress={() => router.push(`/items/${item.id}`)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.itemHeaderRow}>
        <View style={styles.itemIconSquircle}>
          <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
        </View>
        <View style={styles.itemTitleCol}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.categoryName ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {item.categoryName.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.shareBtn}
          hitSlop={8}
          onPress={onShare}
        >
          <Feather name="share-2" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.itemStatsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{t("items.salePrice", "Sale Price")}</Text>
          <Text style={styles.statValue}>{formatNpr(item.sellingPrice)}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{t("items.purchasePrice", "Purchase Price")}</Text>
          <Text style={styles.statValue}>{formatNpr(item.purchasePrice)}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{t("items.inStock", "In Stock")}</Text>
          <View style={[styles.stockPill, { backgroundColor: stockQty > 0 ? "#F0FDF4" : "#FEF2F2", borderColor: stockQty > 0 ? "#BBF7D0" : "#FECDD3" }]}>
            <Text style={[styles.stockPillText, { color: inStockColor }]}>
              {formatNumber(item.stockQuantity)} {item.primaryUnitCode ?? ""}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedTouchable>
  );
}

export default function ItemsScreen() {
  const { t } = useTranslation();
  const canSee = useModuleAccess();
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
      apiFetch("/api/mobile/items")
        .then((data) => {
          if (token !== requestToken.current) return;
          setItems(Array.isArray(data) ? data : []);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.barcodeValue?.toLowerCase().includes(q) ||
        item.categoryName?.toLowerCase().includes(q),
    );
  }, [items, search]);

  function handleShare(item) {
    const text = `Item: ${item.name}\nSale Price: ${formatNpr(item.sellingPrice)}\nIn Stock: ${item.stockQuantity} ${item.primaryUnitCode ?? ""}`;
    Share.share({ message: text });
  }

  function openQuickLink(link) {
    if (link.href) {
      router.push(link.href);
      return;
    }
    router.push({ pathname: "/coming-soon", params: { title: t(`items.${link.key}`) } });
  }

  // Tab screen: the tab bar already clears the system nav inset, so adding
  // insets.bottom here double-counted it (16dp on gesture, 48dp on 3-button).
  const listPaddingBottom = 96;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <AppHeader title={t("nav.items", "Items")} />

      {/* Quick Links Card */}
      <View style={styles.quickLinksCard}>
        <Text style={styles.sectionTitle}>{t("home.quickLinks", "Quick Links")}</Text>
        <View style={styles.quickLinksRow}>
          {QUICK_LINKS.filter((link) => canSee(link.module)).map((link) => (
            <TouchableOpacity
              key={link.key}
              style={styles.quickLink}
              activeOpacity={0.75}
              onPress={() => openQuickLink(link)}
              accessibilityRole="button"
              accessibilityLabel={t(`items.${link.key}`)}
            >
              <View style={[styles.quickLinkIcon, { backgroundColor: link.bg, borderColor: link.border, borderWidth: 1 }]}>
                <MaterialCommunityIcons name={link.icon} size={22} color={link.color} />
              </View>
              <Text style={styles.quickLinkLabel} numberOfLines={1}>
                {t(`items.${link.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search Toolbar */}
      <View style={styles.searchBarContainer}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("items.searchPlaceholder", "Search for an item or code")}
        />
      </View>

      {loading ? (
        <View style={[styles.listContent, { paddingBottom: listPaddingBottom }]}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="package"
              title={t("items.noItemsTitle", "No items found")}
              body={t("items.noItemsBody", "Items and products you create will appear here.")}
            />
          }
          renderItem={({ item, index }) => (
            <ItemCardRow
              item={item}
              delay={staggerDelay(index)}
              onShare={() => handleShare(item)}
            />
          )}
        />
      )}

      <BottomFAB
        bottomOffset={16}
        label={t("items.addNewItem", "Add New Item")}
        icon="package"
        onPress={() => router.push("/items/new")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  quickLinksCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  quickLinksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickLink: {
    alignItems: "center",
    flex: 1,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLinkLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    paddingHorizontal: 16,
  },
  itemCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  itemIconSquircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitleCol: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  itemCategoryText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: "rgba(152,95,253,0.08)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  categoryBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  shareBtn: {
    padding: 6,
  },
  itemStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  statCol: {
    gap: 2,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  stockPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stockPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
