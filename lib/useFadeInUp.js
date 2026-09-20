import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * One mount-in animation used across list rows/cards (ListRow, deal cards,
 * etc.) so every list in the app enters the same way instead of each
 * screen hand-rolling its own Animated.Value. Built on React Native's
 * built-in Animated API — no react-native-reanimated dependency, so this
 * needed no native rebuild to ship or test (unlike google-signin/
 * notifications/ml-kit, which did).
 *
 * `delay` lets a FlatList give each row a slightly later start (index *
 * STAGGER_MS) for a staggered-in look; omit it for a single element.
 */
export function useFadeInUp(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, delay, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { opacity, transform: [{ translateY }] };
}

/** Per-row stagger delay, capped so a long list doesn't take forever to finish animating in. */
export function staggerDelay(index) {
  return Math.min(index, 8) * 35;
}

/**
 * Press-feedback scale (0.96) shared by Button/IconButton — a plain
 * Animated.Value driven from onPressIn/onPressOut, spring back on release.
 */
export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  return { style: { transform: [{ scale }] }, onPressIn, onPressOut };
}
