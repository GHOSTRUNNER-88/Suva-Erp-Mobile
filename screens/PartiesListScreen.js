import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import ListRow from "../components/ui/ListRow";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const TYPE_FILTERS = ["All", "Customer", "Supplier", "Both"];

function PartyAvatar({ name, type }) {
  const initial = String(name || "P").charAt(0).toUpperCase();
  const bg = type === "Customer" ? "#EDE9FE" : type === "Supplier" ? "#FEF3C7" : "#E0F2FE";
  const fg = type === "Customer" ? "#7C3AED" : type === "Supplier" ? "#D97706" : "#0284C7";
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color: fg }]}>{initial}</Text>
    </View>
  );
}

function PartyBalancePill({ balance }) {
  const val = Number(balance ?? 0);
  const isDr = val >= 0;
  return (
    <View style={[styles.balancePill, { backgroundColor: isDr ? "#F0FDF4" : "#FEF2F2", borderColor: isDr ? "#BBF7D0" : "#FECDD3" }]}>
      <Text style={[styles.balanceText, { color: isDr ? colors.success : colors.danger }]}>
        {formatNpr(Math.abs(val))} {isDr ? "Dr" : "Cr"}
      </Text>
    </View>
  );
}

export default function PartiesListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      apiFetch("/api/parties")
        .then((data) => {
          if (token !== requestToken.current) return;
          setParties(Array.isArray(data) ? data : []);
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

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const filtered = parties.filter((party) => {
    if (typeFilter !== "All" && party.type !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [party.name, party.phoneNumber, party.panNumber, party.groupName, party.type].some((field) =>
      String(field ?? "").toLowerCase().includes(q)
    );
  });

  const listPaddingBottom = Math.max(insets.bottom + 84, 96);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("parties.listTitle", { defaultValue: "Parties" })} />

      <View style={styles.searchContainer}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("parties.searchPlaceholder", { defaultValue: "Search parties, phone, PAN..." })}
        />
      </View>

      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((option) => {
          const active = option === typeFilter;
          const label = option === "All" ? t("parties.filterAll", { defaultValue: "All" }) : t(`parties.type${option}`);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setTypeFilter(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={[styles.listContent, { paddingBottom: listPaddingBottom }]}>
          <SkeletonList rows={7} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(party) => String(party.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          ListEmptyComponent={
            <EmptyState icon="users" title={t("home.noPartiesTitle", { defaultValue: "No Parties Found" })} body={t("parties.noPartiesYet", { defaultValue: "No parties added yet." })} />
          }
          renderItem={({ item, index }) => (
            <ListRow
              index={index}
              title={item.name}
              subtitle={[item.phoneNumber, item.groupName].filter(Boolean).join(" · ")}
              leading={<PartyAvatar name={item.name} type={item.type} />}
              trailing={<PartyBalancePill balance={item.balance} />}
              onPress={() => router.push(`/parties/${item.id}`)}
              style={styles.partyRow}
            />
          )}
        />
      )}

      <BottomFAB
        label={t("parties.createParty", { defaultValue: "Add Party" })}
        icon="plus"
        onPress={() => router.push("/parties/new")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  partyRow: { paddingVertical: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  balancePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  balanceText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
});
