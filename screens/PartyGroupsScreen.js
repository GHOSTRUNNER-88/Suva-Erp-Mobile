import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import ScreenHeader from "../components/ui/ScreenHeader";
import SearchToolbar from "../components/ui/SearchToolbar";
import BottomFAB from "../components/ui/BottomFAB";
import { SkeletonList, ErrorState, EmptyState } from "../components/ui/ListStates";
import { useToast } from "../components/ui/Toast";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { usePressScale } from "../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function GroupCard({ item, t }) {
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
          <MaterialCommunityIcons name="folder-account-outline" size={22} color="#8B5CF6" />
        </View>
        <View style={styles.groupInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.memberCount != null ? (
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>
                  {item.memberCount} {t("parties.members", { defaultValue: "members" })}
                </Text>
              </View>
            ) : null}
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        </View>
      </View>
    </AnimatedTouchable>
  );
}

export default function PartyGroupsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      apiFetch("/api/party-groups")
        .then((res) => {
          if (token !== requestToken.current) return;
          const data = res?.data || res;
          setGroups(Array.isArray(data) ? data : []);
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

  async function handleCreateGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      showToast(t("parties.groupNameRequired", { defaultValue: "Group name cannot be blank" }), "error");
      return;
    }
    if (groups.some((g) => g.name?.trim().toLowerCase() === trimmed.toLowerCase())) {
      showToast(t("parties.groupNameExists", { defaultValue: "A group with this name already exists" }), "error");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const result = await apiFetch("/api/party-groups", {
        method: "POST",
        body: { name: trimmed },
      });
      if (result && result.ok === false) {
        const fieldMsg = result.fieldErrors?.name?.[0];
        const errorMsg = fieldMsg || t("parties.groupCreateFailed", { defaultValue: "Failed to create group" });
        showToast(errorMsg, "error");
        return;
      }
      showToast(t("parties.groupCreated", { defaultValue: "Group created" }), "success");
      setNewGroupName("");
      setModalVisible(false);
      load(false);
    } catch (err) {
      showToast(err.message || t("parties.groupCreateFailed", { defaultValue: "Failed to create group" }), "error");
    } finally {
      setSaving(false);
    }
  }

  const filteredGroups = groups.filter((g) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (g.name || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("parties.groupsTitle", { defaultValue: "Party Groups" })} />

      <View style={styles.searchContainer}>
        <SearchToolbar
          value={search}
          onChangeText={setSearch}
          placeholder={t("parties.searchGroupsPlaceholder", { defaultValue: "Search party groups..." })}
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
          data={filteredGroups}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 84, 96) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="users" title={t("parties.noGroups", { defaultValue: "No party groups yet" })} />}
          renderItem={({ item }) => <GroupCard item={item} t={t} />}
        />
      )}

      <BottomFAB
        label={t("parties.newGroup", { defaultValue: "New Group" })}
        icon="plus"
        onPress={() => setModalVisible(true)}
      />

      <Modal visible={modalVisible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{t("parties.newGroup", { defaultValue: "New Group" })}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.iconMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder={t("parties.groupNamePlaceholder", { defaultValue: "Group name (e.g. Wholesalers, VIP)" })}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>{t("common.cancel", { defaultValue: "Cancel" })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateGroup} disabled={saving || !newGroupName.trim()}>
                <Text style={styles.saveText}>{saving ? "..." : t("common.save", { defaultValue: "Save" })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  groupInfo: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  groupName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text, flex: 1 },
  memberBadge: {
    backgroundColor: "rgba(152,95,253,0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  memberBadgeText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.primary },
  description: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", backgroundColor: colors.cardBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    marginBottom: 16,
    backgroundColor: colors.bodyBg,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  saveText: { fontFamily: fonts.semiBold, fontSize: 14, color: "#fff" },
});