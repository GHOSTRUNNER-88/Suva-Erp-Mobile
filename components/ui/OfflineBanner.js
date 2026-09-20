import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useConnectivity, useQueueStats } from "../../lib/offline/hooks";
import { checkConnectivity, setNetworkStatus, syncDelta } from "../../lib/offline/sync";
import { flushQueue } from "../../lib/offline/queue";
import { formatNumber } from "../../lib/format";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * OfflineBanner:
 * Floating or top-bar strip that appears whenever the app is offline
 * or has pending mutations in SQLite.
 *
 * Provides:
 * - Real-time connection status (e.g. "अफलाइन मोड • २ सिङ्क बाँकी" / "Offline Mode • 2 pending changes")
 * - "Sync Now" / "अहिले सिङ्क गर्नुहोस्" button when online with pending mutations
 * - "Retry" / "पुनः प्रयास गर्नुहोस्" button when offline
 * - Smooth slide-down and fade animation with warning/orange background & clean white text
 */
export default function OfflineBanner({ floating = true, style }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOnline } = useConnectivity();
  const { pendingCount = 0, isSyncing = false } = useQueueStats();

  const [retrying, setRetrying] = useState(false);
  const [syncingManual, setSyncingManual] = useState(false);

  const isVisible = !isOnline || pendingCount > 0;
  const anim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [isVisible, anim]);

  const handleSyncNow = useCallback(async () => {
    if (isSyncing || syncingManual) return;
    setSyncingManual(true);
    try {
      await flushQueue();
      await syncDelta();
    } catch {
      // errors handled by sync layer
    } finally {
      setSyncingManual(false);
    }
  }, [isSyncing, syncingManual]);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const online = await checkConnectivity();
      setNetworkStatus(online);
      if (online) {
        await flushQueue();
        await syncDelta();
      }
    } catch {
      setNetworkStatus(false);
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  if (!shouldRender && !isVisible) {
    return null;
  }

  const formattedCount = formatNumber(pendingCount);
  const effectiveSyncing = isSyncing || syncingManual;

  // Build connection status label
  let statusText = "";
  if (!isOnline) {
    if (pendingCount > 0) {
      statusText = t("offline.statusWithPending", {
        count: formattedCount,
        defaultValue: `Offline Mode • ${formattedCount} pending changes`,
      });
    } else {
      statusText = t("offline.offlineMode", { defaultValue: "Offline Mode" });
    }
  } else {
    if (effectiveSyncing) {
      statusText = t("offline.syncingWithPending", {
        count: formattedCount,
        defaultValue: `Syncing... • ${formattedCount} pending`,
      });
    } else {
      statusText = t("offline.onlineWithPending", {
        count: formattedCount,
        defaultValue: `${formattedCount} pending changes`,
      });
    }
  }

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });

  const opacity = anim;

  return (
    <Animated.View
      pointerEvents={isVisible ? "auto" : "none"}
      style={[
        styles.banner,
        floating ? [styles.floatingBanner, { top: insets.top > 0 ? insets.top + 58 : 62 }] : styles.inlineBanner,
        {
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.statusGroup}>
          <View style={styles.iconWrap}>
            {!isOnline ? (
              <Feather name="wifi-off" size={15} color="#FFFFFF" />
            ) : effectiveSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="cloud-off" size={15} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.statusText} numberOfLines={1} ellipsizeMode="tail">
            {statusText}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          {!isOnline ? (
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={handleRetry}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityLabel={t("offline.retry", { defaultValue: "Retry" })}
            >
              {retrying ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.btnSpinner} />
              ) : (
                <Feather name="refresh-cw" size={12} color="#FFFFFF" />
              )}
              <Text style={styles.actionText}>
                {retrying
                  ? t("common.loading", { defaultValue: "Checking..." })
                  : t("offline.retry", { defaultValue: "Retry" })}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={handleSyncNow}
              disabled={effectiveSyncing}
              accessibilityRole="button"
              accessibilityLabel={t("offline.syncNow", { defaultValue: "Sync Now" })}
            >
              {effectiveSyncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.btnSpinner} />
              ) : (
                <Feather name="refresh-cw" size={12} color="#FFFFFF" />
              )}
              <Text style={styles.actionText}>
                {effectiveSyncing
                  ? t("offline.syncing", { defaultValue: "Syncing..." })
                  : t("offline.syncNow", { defaultValue: "Sync Now" })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#EA580C", // Theme warning amber / warm orange
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  inlineBanner: {
    marginHorizontal: 12,
    marginVertical: 6,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  iconWrap: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#FFFFFF",
    flex: 1,
    letterSpacing: 0.1,
  },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  btnSpinner: {
    transform: [{ scale: 0.8 }],
  },
  actionText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#FFFFFF",
  },
});
