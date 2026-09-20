import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { relativeTime } from "../lib/relativeTime";
import { registerForPushNotificationsAsync, sendLocalTestNotification } from "../lib/notifications";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

const TYPE_META = {
  low_stock: { icon: "alert-circle-outline", labelKey: "notifications.lowStock", bg: "#FEF7EB", color: "#D97706", border: "#FDE68A" },
  cheque_due: { icon: "calendar-clock", labelKey: "notifications.chequeDue", bg: "#E6FAFF", color: "#0284C7", border: "#BAE6FD" },
  invoice_overdue: { icon: "clock-alert-outline", labelKey: "notifications.invoiceOverdue", bg: "#FEF2F2", color: "#DC2626", border: "#FECDD3" },
  b2b_order_arrived: { icon: "cart-arrow-down", labelKey: "notifications.b2bOrderArrived", bg: "#F3EEFF", color: "#7C3AED", border: "#DDD6FE" },
  b2b_payment_submitted: { icon: "cash-check", labelKey: "notifications.b2bPaymentSubmitted", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  salary_disbursed: { icon: "cash-multiple", labelKey: "notifications.salaryDisbursed", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("appNotifications");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestToken = useRef(0);

  const load = useCallback(
    (isRefresh) => {
      const token = ++requestToken.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      apiFetch("/api/mobile/notifications")
        .then((data) => {
          if (token !== requestToken.current) return;
          setItems(Array.isArray(data?.items) ? data.items : []);
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

  const handleNotificationPress = useCallback((item) => {
    if (item.type === "salary_disbursed") {
      const salaryRunId = item.entityId || item.params?.salaryRunId;
      if (salaryRunId) {
        router.push(`/payroll/salary-letters/${salaryRunId}`);
      } else {
        router.push("/payroll/salary-letters");
      }
    } else if (item.type === "invoice_overdue") {
      const invoiceId = item.entityId || item.params?.invoiceId;
      if (invoiceId) {
        router.push(`/sales/${invoiceId}`);
      }
    } else if (item.type === "payment_in") {
      router.push("/payments");
    }
  }, []);

  const displayItems = tab === "appNotifications" ? items : [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("notifications.title", "Notifications")} />

      {/* Segmented Pill Tabs */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, tab === "appNotifications" && styles.segmentActive]}
          onPress={() => setTab("appNotifications")}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, tab === "appNotifications" && styles.segmentTextActive]}>
            {t("notifications.appNotifications", "App Notifications")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === "allTransactions" && styles.segmentActive]}
          onPress={() => setTab("allTransactions")}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, tab === "allTransactions" && styles.segmentTextActive]}>
            {t("notifications.allTransactions", "All Transactions")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Push Notification Setup Banner */}
      <View style={styles.pushBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pushBannerTitle}>
            <Feather name="bell" size={13} color={colors.primary} /> {t("notifications.mobileAlertsTitle", "Push Notifications")}
          </Text>
          <Text style={styles.pushBannerSubtitle}>
            {t("notifications.mobileAlertsSubtitle", "Receive instant alerts on this phone for sales, payments, and stock.")}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.pushBtn}
          onPress={async () => {
            await registerForPushNotificationsAsync();
            await sendLocalTestNotification(
              t("notifications.testTitle", "Suva ERP Alert"),
              t("notifications.testBody", "Mobile push notifications are working on this device!")
            );
          }}
        >
          <Text style={styles.pushBtnText}>{t("notifications.setupOrTest", "Setup / Test")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <SkeletonList rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
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
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconSquircle}>
                <MaterialCommunityIcons name="bell-off-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {tab === "appNotifications"
                  ? t("notifications.empty", "You're all caught up!")
                  : "No transaction notifications"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === "appNotifications"
                  ? "We'll notify you about low stock, due dates, and important alerts here."
                  : "Transaction events and system logs will appear here."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = TYPE_META[item.type] || {
              icon: "bell-outline",
              labelKey: "notifications.general",
              bg: "#F1F5F9",
              color: colors.textMuted,
              border: "#E2E8F0",
            };

            const title = item.titleKey ? t(item.titleKey, item.params) : (meta ? t(meta.labelKey) : item.type);
            const subtitle = item.bodyKey ? t(item.bodyKey, item.params) : null;

            return (
              <TouchableOpacity
                style={[styles.cardRow, !item.isRead && styles.cardRowUnread]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(item)}
              >
                <View style={[styles.cardRowIcon, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                  <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={styles.cardRowBody}>
                  <Text style={styles.cardRowTitle}>{title}</Text>
                  {subtitle ? (
                    <Text style={styles.cardRowSubtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                  <Text style={styles.cardRowTime}>{relativeTime(item.createdAt)}</Text>
                </View>
                {!item.isRead ? <View style={styles.unreadBadgeDot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  segmentRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginVertical: 12,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: colors.cardBg,
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: tint("primary", 0.08),
  },
  segmentText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  cardRowUnread: {
    borderColor: tint("primary", 0.3),
    backgroundColor: "#FFFBFE",
  },
  cardRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardRowBody: {
    flex: 1,
  },
  cardRowTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  cardRowSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 2,
  },
  cardRowTime: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  unreadBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconSquircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  pushBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  pushBannerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 2,
  },
  pushBannerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
  },
  pushBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pushBtnText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#FFFFFF",
  },
});
