import { useEffect, useRef } from "react";
import { Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { usePressScale } from "../../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function BottomFAB({
  label,
  icon = "plus",
  onPress,
  style,
  bottomOffset,
}) {
  const insets = useSafeAreaInsets();
  const bottom = bottomOffset !== undefined ? bottomOffset : Math.max(insets.bottom + 16, 20);
  const press = usePressScale();

  const enterScale = useRef(new Animated.Value(0.85)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(enterScale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }),
      Animated.timing(enterOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <AnimatedTouchable
      style={[
        styles.fab,
        { bottom, opacity: enterOpacity },
        press.style,
        style,
      ]}
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color="#fff" />
      <Text style={styles.fabText}>{label}</Text>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 10,
  },
  fabText: {
    color: "#fff",
    fontFamily: fonts.semiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
