import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenHeader from "../components/ui/ScreenHeader";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import AppHeader from "../components/ui/AppHeader";
import { useToast } from "../components/ui/Toast";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { initDb, clearAllData, getCacheSize, getSyncMeta, setSyncMeta, getAllCacheKeys } from "../lib/offline/db";
import { downloadCompany, syncDelta, applyPendingChanges, getSyncStatus } from "../lib/offline/sync";
import { getDownloadEndpoints } from "../lib/offline/sync";
import { flushQueue } from "../lib/offline/queue";
import { isCrashlyticsActive, logCrashlytics, recordCrashlyticsError } from "../firebase/crashlytics";

export default function OfflineManagerScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  // Emits a non-fatal so the Crashlytics pipeline can be verified from a real
  // (including Play Store) build. Reports "inactive" rather than claiming
  // success when the native module is missing.
  function handleSendTestReport() {
    if (!isCrashlyticsActive()) {
      Alert.alert(
        t("offline.diagnostics.inactiveTitle", { defaultValue: "Crash reporting inactive" }),
        t("offline.diagnostics.inactiveMessage", { defaultValue: "The Crashlytics native module is not available in this build, so nothing was sent." })
      );
      return;
    }
    const err = new Error("SuvaCrashlyticsTestReport");
    logCrashlytics(`Test report requested at ${new Date().toISOString()}`);
    recordCrashlyticsError(err, "Manual test report from Offline Manager > Diagnostics");
    Alert.alert(
      t("offline.diagnostics.sentTitle", { defaultValue: "Test report sent" }),
      t("offline.diagnostics.sentMessage", { defaultValue: "Open Firebase Console → Crashlytics in a few minutes. It appears as a non-fatal issue named SuvaCrashlyticsTestReport." })
    );
  }

  const [status, setStatus] = useState({ isDownloaded: false, lastFullSync: null, lastDeltaSync: null, pendingWriteCount: 0, hasPendingWrites: false });
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [cacheSize, setCacheSize] = useState(0);
  const [cacheEntries, setCacheEntries] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const refreshStatus = useCallback(() => {
    const s = getSyncStatus();
    setStatus(s);
    setCacheSize(getCacheSize());
    setCacheEntries(getAllCacheKeys());
  }, []);

  useEffect(() => {
    initDb();
    refreshStatus();
  }, [refreshStatus]);

  const handleDownloadCompany = useCallback(async () => {
    Alert.alert(
      t("offline.downloadConfirmTitle", { defaultValue: "Download Company Data" }),
      t("offline.downloadConfirmMessage", { defaultValue: "This will download all your company data to your device for offline use. This may take a few minutes." }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        { text: t("offline.downloadNow", { defaultValue: "Download Now" }), style: "destructive", onPress: () => doDownload() },
      ],
    );
  }, [t]);

  const doDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);
    setProgress({ loaded: 0, total: 0, entityType: "" });

    try {
      const result = await downloadCompany((p) => {
        setProgress({ loaded: p.loaded, total: p.total, entityType: p.entityType, status: p.status });
      });

      if (result.errors.length > 0) {
        showToast(`${result.completed}/${result.total} entities downloaded. ${result.errors.length} errors.`, "warning");
      } else {
        showToast(t("offline.downloadComplete", { defaultValue: "Company data downloaded successfully" }), "success");
      }
      refreshStatus();
    } catch (err) {
      setError(err.message || "Download failed");
      showToast(t("offline.downloadFailed", { defaultValue: "Download failed" }), "error");
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }, [showToast, refreshStatus, t]);

  const handleSyncDelta = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncDelta();
      if (result.ok) {
        showToast(t("offline.syncComplete", { defaultValue: "Sync complete" }), "success");
      } else {
        showToast(result.error || "Sync failed", "error");
      }
      refreshStatus();
    } catch (err) {
      setError(err.message || "Sync failed");
      showToast(t("offline.syncFailed", { defaultValue: "Sync failed" }), "error");
    } finally {
      setSyncing(false);
    }
  }, [showToast, refreshStatus, t]);

  const handlePushChanges = useCallback(async () => {
    setPushing(true);
    setError(null);
    try {
      const results = await flushQueue();
      const pushed = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok).length;
      if (pushed > 0) {
        showToast(t("offline.pushComplete", { count: pushed, defaultValue: `${pushed} changes synced` }), "success");
      }
      if (failed > 0) {
        showToast(t("offline.pushFailed", { count: failed, defaultValue: `${failed} changes failed to sync` }), "error");
      }
      refreshStatus();
    } catch (err) {
      showToast(t("offline.pushFailed", { defaultValue: "Push failed" }), "error");
    } finally {
      setPushing(false);
    }
  }, [showToast, refreshStatus, t]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      t("offline.clearCacheTitle", { defaultValue: "Clear Offline Data" }),
      t("offline.clearCacheMessage", { defaultValue: "This will remove all downloaded data from your device. You will need to re-download company data to use the app offline." }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        {
          text: t("offline.clearCache", { defaultValue: "Clear Cache" }),
          style: "destructive",
          onPress: () => {
            clearAllData();
            refreshStatus();
            showToast(t("offline.cacheCleared", { defaultValue: "Offline data cleared" }), "success");
          },
        },
      ],
    );
  }, [showToast, refreshStatus, t]);

  const onRefresh = useCallback(() => {
    refreshStatus();
  }, [refreshStatus]);

  const endpoints = getDownloadEndpoints();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader title={t("offline.title", { defaultValue: "Offline" })} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <MaterialCommunityIcons name={status.isDownloaded ? "cloud-check" : "cloud-off-outline"} size={24} color={status.isDownloaded ? colors.success : colors.warning} />
            <Text style={styles.statusTitle}>
              {status.isDownloaded ? t("offline.statusDownloaded", { defaultValue: "Data available offline" }) : t("offline.statusNotDownloaded", { defaultValue: "No offline data" })}
            </Text>
          </View>
          {status.lastFullSync ? (
            <Text style={styles.statusSubtitle}>{t("offline.lastSync", { value: new Date(status.lastFullSync).toLocaleString(), defaultValue: "Last sync: {{value}}" })}</Text>
          ) : null}
          {status.hasPendingWrites && (
            <Text style={styles.pendingBadge}>{status.pendingWriteCount} {t("offline.pendingWrites", { defaultValue: "pending changes" })}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("offline.download.title", { defaultValue: "Download Company Data" })}</Text>
          <Text style={styles.sectionHelper}>{t("offline.download.helper", { defaultValue: "Download all your company data to use the app fully offline." })}</Text>

          {downloading && progress ? (
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>{progress.entityType || t("offline.downloading", { defaultValue: "Downloading..." })}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(progress.loaded / progress.total) * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress.loaded}/{progress.total}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.actionButton, status.isDownloaded && styles.actionButtonSecondary]} activeOpacity={0.85} onPress={handleDownloadCompany} disabled={downloading}>
            {downloading ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="download" size={18} color="#fff" />}
            <Text style={styles.actionButtonText}>{downloading ? t("offline.downloading", { defaultValue: "Downloading..." }) : t("offline.downloadNow", { defaultValue: "Download Company Data" })}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("offline.sync.title", { defaultValue: "Sync" })}</Text>
          <Text style={styles.sectionHelper}>{t("offline.sync.helper", { defaultValue: "Sync recent changes and push pending writes." })}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSmall]} activeOpacity={0.85} onPress={handleSyncDelta} disabled={syncing || !status.isDownloaded}>
              {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="refresh-cw" size={16} color="#fff" />}
              <Text style={styles.actionButtonTextSmall}>{t("offline.syncNow", { defaultValue: "Sync Now" })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSmall, status.pendingWriteCount === 0 && styles.actionButtonDisabled]} activeOpacity={0.85} onPress={handlePushChanges} disabled={pushing || status.pendingWriteCount === 0}>
              {pushing ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="upload" size={16} color="#fff" />}
              <Text style={styles.actionButtonTextSmall}>{t("offline.pushChanges", { defaultValue: "Push Changes" })}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("offline.cache.title", { defaultValue: "Cache" })}</Text>
          <Text style={styles.sectionHelper}>{t("offline.cache.helper", { defaultValue: `${cacheSize} items cached locally.` })}</Text>

          <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonSmall]} activeOpacity={0.85} onPress={handleClearCache}>
            <Feather name="trash-2" size={16} color={colors.danger} />
            <Text style={[styles.actionButtonTextSmall, { color: colors.danger }]}>{t("offline.clearCache", { defaultValue: "Clear Cache" })}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("offline.diagnostics.title", { defaultValue: "Diagnostics" })}</Text>
          <Text style={styles.sectionHelper}>{t("offline.diagnostics.helper", { defaultValue: "Send a test report to confirm crash reporting is working." })}</Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonSmall]}
            activeOpacity={0.85}
            onPress={handleSendTestReport}
          >
            <Feather name="activity" size={16} color={colors.primary} />
            <Text style={styles.actionButtonTextSmall}>
              {t("offline.diagnostics.sendTestReport", { defaultValue: "Send Test Report" })}
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <ErrorState message={error} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  scrollContent: { padding: 16 },
  statusCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  statusHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  statusTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  statusSubtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  pendingBadge: {
    backgroundColor: colors.primary + "10",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, marginBottom: 4 },
  sectionHelper: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  progressCard: { backgroundColor: colors.bodyBg, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight },
  progressLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginBottom: 8 },
  progressBar: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, textAlign: "right" },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionButtonSecondary: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border },
  actionButtonSmall: { paddingVertical: 10 },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontFamily: fonts.semiBold, fontSize: 14, color: "#fff" },
  actionButtonTextSmall: { fontFamily: fonts.medium, fontSize: 13, color: "#fff" },
  actionsRow: { flexDirection: "row", gap: 12 },
});
