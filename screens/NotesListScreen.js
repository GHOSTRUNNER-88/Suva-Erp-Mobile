import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect, usePathname } from "expo-router";
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

function NoteCard({ item, isCredit, numberKey, dateKey, noteType, delay = 0 }) {
  const press = usePressScale();
  const enterAnim = useFadeInUp(delay);

  const docNumber = item[numberKey] || `#${item.id}`;
  const docDate = item[dateKey] ? String(item[dateKey]).slice(0, 10) : "";
  const partyName = item.partyName || "—";

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnim, press.style]}
      activeOpacity={0.88}
      onPress={() => router.push({ pathname: `/${isCredit ? "credit-notes" : "debit-notes"}/${item.id}`, params: { type: noteType } })}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${docNumber} ${partyName}`}
    >
      <View style={styles.topRow}>
        <View style={styles.partyWrap}>
          <Text style={styles.partyName} numberOfLines={1}>
            {partyName}
          </Text>
          <Text style={styles.docNumber}>{docNumber}</Text>
        </View>
        <View style={styles.rightMeta}>
          <Text style={styles.amount}>{formatNpr(item.totalAmount)}</Text>
          {docDate ? <Text style={styles.dateText}>{docDate}</Text> : null}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.badge, isCredit ? styles.badgeCredit : styles.badgeDebit]}>
          <Text style={[styles.badgeText, isCredit ? styles.badgeTextCredit : styles.badgeTextDebit]}>
            {isCredit ? "CREDIT NOTE" : "DEBIT NOTE"}
          </Text>
        </View>
        {item.reason ? (
          <Text style={styles.reasonText} numberOfLines={1}>
            {item.reason}
          </Text>
        ) : null}
      </View>
    </AnimatedTouchable>
  );
}

export default function NotesListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams();
  const pathname = usePathname();
  const isDebit = type === "debit" || (pathname && pathname.includes("debit"));
  const noteType = isDebit ? "debit" : "credit";
  const isCredit = !isDebit;

  const [notes, setNotes] = useState([]);
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
      apiFetch(`/api/mobile/${isCredit ? "credit-notes" : "debit-notes"}`)
        .then((data) => {
          if (token !== requestToken.current) return;
          setNotes(Array.isArray(data) ? data : []);
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
    [isCredit, t],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const numberKey = isCredit ? "creditNoteNumber" : "debitNoteNumber";
  const dateKey = isCredit ? "creditNoteDate" : "debitNoteDate";
  const title = isCredit ? t("creditDebit.creditTitle", { defaultValue: "Credit Notes" }) : t("creditDebit.debitTitle", { defaultValue: "Debit Notes" });

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((item) => {
      const num = String(item[numberKey] || item.id || "");
      const party = String(item.partyName || "");
      const reason = String(item.reason || "");
      return num.toLowerCase().includes(q) || party.toLowerCase().includes(q) || reason.toLowerCase().includes(q);
    });
  }, [notes, numberKey, search]);

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
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="file-text" title={t("creditDebit.noNotes", { defaultValue: "No notes recorded yet" })} />}
          renderItem={({ item, index }) => (
            <NoteCard
              item={item}
              isCredit={isCredit}
              numberKey={numberKey}
              dateKey={dateKey}
              noteType={noteType}
              delay={staggerDelay(index)}
            />
          )}
        />
      )}

      <BottomFAB
        label={t("creditDebit.create", { defaultValue: isCredit ? "+ Add Credit Note" : "+ Add Debit Note" })}
        icon="plus"
        onPress={() => router.push({ pathname: `/${isCredit ? "credit-notes" : "debit-notes"}/new`, params: { type: noteType } })}
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
    color: colors.text,
  },
  dateText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeCredit: {
    backgroundColor: `${colors.success}15`,
  },
  badgeDebit: {
    backgroundColor: `${colors.warning}18`,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  badgeTextCredit: {
    color: colors.success,
  },
  badgeTextDebit: {
    color: "#B47300",
  },
  reasonText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "right",
  },
});

