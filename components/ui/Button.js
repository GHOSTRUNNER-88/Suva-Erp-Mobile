import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { usePressScale } from "../../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * The one button component every screen should use — primary/secondary/
 * ghost/danger variants, always a real 44px+ touch target. Replaces the
 * repeated inline `TouchableOpacity` + ad-hoc style objects scattered
 * across screens. Every instance gets the same press-in scale feedback
 * (lib/useFadeInUp.js's usePressScale) for free — one change here reaches
 * every button in the app.
 */
export default function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconColor,
  loading = false,
  disabled = false,
  style,
  fullWidth = true,
}) {
  const isDisabled = disabled || loading;
  const press = usePressScale();
  const resolvedIconColor =
    iconColor ??
    (variant === "primary" || variant === "danger"
      ? "#fff"
      : variant === "secondary"
      ? colors.text
      : colors.primary);
  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        press.style,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" || variant === "danger" ? "#fff" : colors.primary} />
      ) : (
        <>
          {icon ? (
            <Feather
              name={icon}
              size={18}
              color={variant === "primary" || variant === "danger" ? "#fff" : colors.primary}
              color={resolvedIconColor}
              style={styles.icon}
            />
          ) : null}
          <Text
            style={[styles.label, styles[`${variant}Label`]]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {label}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

/** A bare icon-only button — quick-create "+", remove, etc. Always 44x44. Same press-scale feedback as Button. */
export function IconButton({ icon, onPress, color = colors.text, accessibilityLabel, style, size = 18 }) {
  const press = usePressScale();
  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.iconButton, press.style, style]}
    >
      <Feather name={icon} size={size} color={color} />
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    // Pill + generous side padding, matching ui/BottomFAB (the "Add New Sale"
    // button on Home) — that is the reference CTA for the whole app.
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fullWidth: { width: "100%" },
  icon: { marginRight: 8 },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondary: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
  danger: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.semiBold, fontSize: 14, letterSpacing: 0.3 },
  primaryLabel: { color: "#fff" },
  dangerLabel: { color: "#fff" },
  secondaryLabel: { color: colors.text },
  ghostLabel: { color: colors.primary },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
