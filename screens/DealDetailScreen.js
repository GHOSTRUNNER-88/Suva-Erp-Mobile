import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNpr } from "../lib/format";
import { dealStageColor } from "../lib/dealStageColor";
import { SkeletonList, ErrorState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const STAGES = ["New", "Qualified", "Proposal", "Won", "Lost"];

/** Real data via GET /api/mobile/deals/[id]. Quick stage change via PATCH /api/mobile/deals/[id]/stage — the one "special action" desktop's own Deals list has, mirrored here as a row of tappable chips instead of a dropdown. */
export default function DealDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    apiFetch(`/api/mobile/deals/${id}`)
      .then((result) => {
        if (token !== requestToken.current) return;
        setDeal(result ?? null);
      })
      .catch((err) => {
        if (token !== requestToken.current) return;
        setError(err.messageKey ? t(err.messageKey) : err.message);
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
      });
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStageChange(stage) {
    if (updatingStage || !deal || stage === deal.stage) return;
    const previous = deal.stage;
    setDeal((current) => ({ ...current, stage }));
    setUpdatingStage(true);
    try {
      await apiFetch(`/api/mobile/deals/${id}/stage`, { method: "PATCH", body: { stage } });
    } catch {
      // The optimistic chip used to snap back with no explanation, which
      // reads as the tap simply not registering.
      setDeal((current) => ({ ...current, stage: previous }));
      Alert.alert(t("common.somethingWentWrong"));
    } finally {
      setUpdatingStage(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("crm.detailTitle")}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonList rows={5} />
        </View>
      ) : error || !deal ? (
        // A null-but-successful response used to render a blank white screen.
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.dealTitle}>{deal.title}</Text>
            {deal.partyName ? (
              <Text style={styles.meta}>
                {t("crm.contact")}: {deal.partyName}
              </Text>
            ) : null}
            {deal.leadSourceName ? (
              <Text style={styles.meta}>
                {t("crm.leadSource")}: {deal.leadSourceName}
              </Text>
            ) : null}
            {deal.expectedRevenue ? (
              <Text style={styles.meta}>
                {t("crm.expectedRevenue")}: {formatNpr(deal.expectedRevenue)}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("crm.stage")}</Text>
            <View style={styles.stageRow}>
              {STAGES.map((stage) => {
                const active = stage === deal.stage;
                const color = dealStageColor(stage);
                return (
                  <TouchableOpacity
                    key={stage}
                    style={[styles.stageChip, { borderColor: color }, active && { backgroundColor: color }]}
                    onPress={() => handleStageChange(stage)}
                    disabled={updatingStage}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: updatingStage }}
                    accessibilityLabel={t(`crm.stage${stage}`)}
                  >
                    <Text style={[styles.stageChipText, { color: active ? "#fff" : color }]}>{t(`crm.stage${stage}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontFamily: fonts.medium, textAlign: "center", padding: 24 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  dealTitle: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text, marginBottom: 8 },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: 12 },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stageChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  stageChipText: { fontFamily: fonts.semiBold, fontSize: 12 },
});
