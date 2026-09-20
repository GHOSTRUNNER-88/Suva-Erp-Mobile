import { useEffect, useState } from "react";
import { View, StyleSheet, Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Button from "./Button";

/**
 * Bottom action row for create/edit forms — transparent (no panel fill or
 * top border), safe-area aware, keyboard aware. Place it as the LAST child of the
 * screen's KeyboardAvoidingView (scroll content above, this bar below), not
 * position:absolute — that way iOS "padding" behaviour lifts the whole
 * column (bar included) above the keyboard, and Android's default
 * window-resize does the same. While the keyboard is open the home-indicator
 * inset is covered anyway, so the bar drops back to its base padding instead
 * of stacking inset + keyboard height.
 *
 * Two ways to use it:
 *   <StickyActionBar primaryLabel="Save" onPrimary={save} loading={saving} />
 *   <StickyActionBar>{...custom buttons...}</StickyActionBar>
 */
export default function StickyActionBar({
  children,
  style,
  primaryLabel,
  onPrimary,
  loading = false,
  disabled = false,
  secondaryLabel,
  onSecondary,
  primaryIcon,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const paddingBottom = keyboardVisible ? 12 : Math.max(insets.bottom, 12);
  // Alone, the primary hugs its label like BottomFAB; paired with a
  // secondary it goes back to sharing the row.
  const hasSecondary = Boolean(secondaryLabel || onSecondary);

  return (
    <View style={[styles.bar, { paddingBottom }, style]}>
      {children ?? (
        <>
          {hasSecondary ? (
            <Button label={secondaryLabel ?? t("common.cancel")} variant="secondary" onPress={onSecondary} disabled={loading} style={styles.secondary} />
          ) : null}
          <Button
            label={loading ? t("forms.saving") : primaryLabel ?? t("forms.save")}
            onPress={onPrimary}
            loading={loading}
            disabled={disabled}
            icon={primaryIcon}
            fullWidth={hasSecondary}
            style={hasSecondary ? styles.primary : undefined}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    // Deliberately transparent: no panel fill, no top rule — the pill button
    // sits straight on the screen background.
    backgroundColor: "transparent",
  },
  secondary: { flex: 1 },
  primary: { flex: 2 },
});
