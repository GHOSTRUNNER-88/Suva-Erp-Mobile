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

function DocumentCard({
  item,
  numberKey,
  dateKey,
  partyKey,
  amountKey,
  statusKey,
  detailRoutePrefix,
  delay = 0,
}) {
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const docNumber = item[numberKey] || item.documentNo || item.orderNumber || item.quotationNumber || item.challanNumber || item.transferNumber || item.reference || `#${item.id}`;
  const docDate = item[dateKey] || item.orderDate || item.quotationDate || item.challanDate || item.transferDate || item.date || item.createdAt;
  const docParty = item[partyKey] || item.partyName || item.supplierName || item.customerName || item.fromWarehouseName;
  const docAmount = amountKey && item[amountKey] != null ? item[amountKey] : null;
  const docStatus = statusKey ? item[statusKey] : null;

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPress={() => {
        if (detailRoutePrefix) {
          router.push(`${detailRoutePrefix}/${item.id}`);
        }
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${docNumber} ${docParty || ""}`.trim()}
    >
      <View style={styles.topRow}>
        <View style={styles.partyWrap}>
          <Text style={styles.partyName} numberOfLines={1}>
            {docParty || docNumber}
          </Text>
          {docParty ? (
            <Text style={styles.docNumber} numberOfLines={1}>
              {docNumber}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightMeta}>
          {docAmount != null ? <Text style={styles.amount}>{formatNpr(docAmount)}</Text> : null}
          {docDate ? <Text style={styles.dateText}>{String(docDate).slice(0, 10)}</Text> : null}
        </View>
      </View>

      {docStatus ? (
        <View style={styles.bottomRow}>
          <StatusBadge status={docStatus} />
        </View>
      ) : null}
    </AnimatedTouchable>
  );
}

export default function DocumentListScreen({
  title,
  endpoint,
  numberKey = "number",
  dateKey = "date",
  partyKey = "partyName",
  amountKey = "totalAmount",
  statusKey = "status",
  detailRoutePrefix,
  createRoute,
  emptyTitle,
  renderCustomRow,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
      apiFetch(endpoint)
        .then((data) => {
          if (token !== requestToken.current) return;
          const rows = Array.isArray(data) ? data : data?.rows || data?.items || [];
          setItems(Array.isArray(rows) ? rows : []);
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
    [endpoint, t],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const docNum = String(item[numberKey] || item.documentNo || item.orderNumber || item.quotationNumber || item.challanNumber || item.transferNumber || item.reference || item.id || "");
      const party = String(item[partyKey] || item.partyName || item.supplierName || item.customerName || item.fromWarehouseName || item.itemName || "");
      return docNum.toLowerCase().includes(q) || party.toLowerCase().includes(q);
    });
  }, [items, numberKey, partyKey, search]);

  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={title} />

      <View style={styles.searchWrap}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("common.searchPlaceholder", { defaultValue: "Search number, party..." })}
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
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="file-text" title={emptyTitle || t("common.empty", { defaultValue: "No records yet" })} />}
          renderItem={({ item, index }) => {
            if (renderCustomRow) return renderCustomRow(item);
            return (
              <DocumentCard
                item={item}
                numberKey={numberKey}
                dateKey={dateKey}
                partyKey={partyKey}
                amountKey={amountKey}
                statusKey={statusKey}
                detailRoutePrefix={detailRoutePrefix}
                delay={staggerDelay(index)}
              />
            );
          }}
        />
      )}

      {createRoute ? (
        <BottomFAB
          label={t("common.new", { defaultValue: "+ New" })}
          icon="plus"
          onPress={() => router.push(createRoute)}
        />
      ) : null}
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
    gap: 3,
  },
  partyName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  docNumber: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  rightMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primary,
  },
  dateText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});