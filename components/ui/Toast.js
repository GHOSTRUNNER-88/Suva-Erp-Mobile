import { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

const ToastContext = createContext(null);

const ICONS = { success: "check-circle", error: "alert-circle", info: "info" };
const TONES = { success: colors.success, error: colors.danger, info: colors.primary };

/** Mount once at the app root (see app/_layout.js) — wraps the whole tree. */
export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);
  const hideAnimTimer = useRef(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (message, type = "info") => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (hideAnimTimer.current) clearTimeout(hideAnimTimer.current);
      setToast({ message, type });
      translateY.setValue(-80);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(hide, 2500);
    },
    [hide, opacity, translateY],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { top: insets.top + 8, borderColor: TONES[toast.type] ?? colors.border, transform: [{ translateY }], opacity },
          ]}
        >
          <Feather name={ICONS[toast.type] ?? "info"} size={16} color={TONES[toast.type] ?? colors.primary} />
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

/** Returns { showToast(message, "success"|"error"|"info") }. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 999,
  },
  toastText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
