import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "./ScreenHeader";
import { SkeletonForm, ErrorState } from "./ListStates";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/**
 * The shared skeleton every create/edit screen sits in:
 *
 *   SafeAreaView (top/left/right — bottom is StickyActionBar's job)
 *   └ ScreenHeader
 *   └ KeyboardAvoidingView ("padding" on iOS; Android resizes the window)
 *       ├ ScrollView  (form body — keyboard taps pass through, drag dismisses)
 *       └ footer      (a StickyActionBar — sits above the keyboard)
 *
 * `loading` swaps the body for a form skeleton; `error` swaps it for an
 * ErrorState with retry. The header stays put in both cases so the user
 * always has a way back.
 */
export default function FormScreen({ title, subtitle, onBack, right, loading = false, error = null, onRetry, children, footer, contentStyle }) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} right={right} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {loading ? <SkeletonForm /> : error ? <ErrorState message={error} onRetry={onRetry} /> : children}
        </ScrollView>
        {!loading && !error && footer ? footer : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A titled card grouping related fields — mirrors desktop's card-per-section layout. */
export function FormSection({ title, children, style }) {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  section: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    paddingBottom: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 },
});
