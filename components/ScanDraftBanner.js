import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "./ui/ConfirmDialog";
import { translateScanFields } from "../lib/scanDraftReview";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

/**
 * "Scanned draft — review before saving" notice shown at the top of a create
 * form opened from Scan Receipt. Lists which fields the scanner couldn't
 * resolve and which it read with low confidence (translated labels, never
 * raw keys), and offers "Clear scanned draft" which removes the stored draft
 * and lets the screen reset its form. Nothing here posts anything.
 */
export default function ScanDraftBanner({ draft, onClear, style }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  if (!draft) return null;

  const unresolved = translateScanFields(t, draft.unresolved);
  const lowConfidence = translateScanFields(t, draft.lowConfidence).filter((label) => !unresolved.includes(label));

  return (
    <View style={[styles.banner, style]} accessibilityRole="alert">
      <View style={styles.headerRow}>
        <Feather name="camera" size={16} color="#B47300" />
        <Text style={styles.title}>{t("scanDraft.title")}</Text>
      </View>
      <Text style={styles.body}>{t("scanDraft.body")}</Text>
      {unresolved.length > 0 ? (
        <View style={styles.listRow}>
          <Feather name="alert-circle" size={13} color={colors.danger} />
          <Text style={styles.listText}>{t("scanDraft.unresolved", { fields: unresolved.join(", ") })}</Text>
        </View>
      ) : null}
      {lowConfidence.length > 0 ? (
        <View style={styles.listRow}>
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={styles.listText}>{t("scanDraft.lowConfidence", { fields: lowConfidence.join(", ") })}</Text>
        </View>
      ) : null}
      <Pressable onPress={() => setConfirming(true)} style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]} accessibilityRole="button">
        <Feather name="x-circle" size={14} color={colors.text} />
        <Text style={styles.clearText}>{t("scanDraft.clear")}</Text>
      </Pressable>

      <ConfirmDialog
        visible={confirming}
        title={t("scanDraft.clearConfirmTitle")}
        message={t("scanDraft.clearConfirmBody")}
        confirmLabel={t("scanDraft.clear")}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onClear?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "rgba(253,175,34,0.10)",
    borderWidth: 1,
    borderColor: "rgba(253,175,34,0.55)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { flex: 1, fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  listText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  clearButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  clearButtonPressed: { backgroundColor: colors.bodyBg },
  clearText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
});
