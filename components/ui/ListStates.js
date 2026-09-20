import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/** A single pulsing placeholder block — compose a few into a skeleton row. */
export function SkeletonBlock({ width = "100%", height = 14, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { width, height, opacity }, style]} />;
}

/** A skeleton shaped like a typical list row — used while a list's first page loads. */
export function SkeletonListRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={{ flex: 1 }}>
        <SkeletonBlock width="55%" height={13} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="35%" height={11} />
      </View>
      <SkeletonBlock width={60} height={20} />
    </View>
  );
}

export function SkeletonList({ rows = 6 }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonListRow key={index} />
      ))}
    </View>
  );
}

/** A skeleton shaped like a create/edit form — label + input pairs inside a card. */
export function SkeletonForm({ fields = 5 }) {
  return (
    <View style={styles.skeletonForm}>
      {Array.from({ length: fields }).map((_, index) => (
        <View key={index} style={styles.skeletonField}>
          <SkeletonBlock width="30%" height={11} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="100%" height={44} style={{ borderRadius: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** Centered spinner + optional label — for short waits where a skeleton would be overkill. */
export function LoadingState({ label }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.body, { marginTop: 12, marginBottom: 0 }]}>{label ?? t("forms.loading")}</Text>
    </View>
  );
}

/**
 * Coerces whatever a caller passed as `message` into something safe to show
 * a person. Anything that isn't a plain string (an Error, a response
 * object, JSON) collapses to the generic copy — raw dumps never reach the
 * screen.
 */
function safeMessage(message, fallback) {
  if (typeof message === "string" && message.trim() && !message.trim().startsWith("{") && !message.trim().startsWith("[")) return message;
  if (message && typeof message === "object" && typeof message.message === "string" && message.message.trim()) return message.message;
  return fallback;
}

export function ErrorState({ message, onRetry, title }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <Feather name="alert-triangle" size={20} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title ?? t("common.somethingWentWrong")}</Text>
      <Text style={styles.body}>{safeMessage(message, t("common.somethingWentWrong"))}</Text>
      {onRetry ? (
        <Button label={t("common.retry")} variant="secondary" icon="refresh-cw" onPress={onRetry} fullWidth={false} style={styles.retryButton} />
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = "inbox", title, body, actionLabel, onAction, compact = false }) {
  return (
    <View style={[styles.center, compact && styles.centerCompact]}>
      <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
        <Feather name={icon} size={compact ? 16 : 20} color={colors.iconMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel ? (
        <Button label={actionLabel} icon="plus" onPress={onAction} fullWidth={false} style={styles.retryButton} />
      ) : null}
    </View>
  );
}

/**
 * Inline (non-centered) error banner for a form's top-level failure — the
 * "formError" a create route returns, or a network failure on submit.
 */
export function InlineError({ message, style }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <View style={[styles.inlineError, style]} accessibilityRole="alert">
      <Feather name="alert-circle" size={16} color={colors.danger} />
      <Text style={styles.inlineErrorText}>{safeMessage(message, t("common.somethingWentWrong"))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 56, paddingHorizontal: 24 },
  centerCompact: { paddingVertical: 24 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bodyBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconCircleCompact: { width: 36, height: 36, borderRadius: 18, marginBottom: 8 },
  title: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, marginBottom: 4, textAlign: "center" },
  body: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: 14 },
  retryButton: { paddingHorizontal: 20 },
  skeleton: { backgroundColor: colors.border, borderRadius: 6 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  skeletonForm: { backgroundColor: colors.cardBg, borderRadius: 12, padding: 16 },
  skeletonField: { marginBottom: 16 },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,103,87,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,103,87,0.35)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  inlineErrorText: { flex: 1, color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
});
