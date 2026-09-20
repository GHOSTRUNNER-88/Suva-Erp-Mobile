import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Keyboard,
  PanResponder,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

const OPEN_DURATION = 260;
const CLOSE_DURATION = 200;
const DRAG_CLOSE_THRESHOLD = 80;
const DRAG_VEL_THRESHOLD = 0.5;

/**
 * Slide-up bottom sheet.
 *
 * Scrim: colors.scrim painted on the modal's DIRECT child (styles.root).
 * Don't move it back onto an absolutely-positioned child — under a
 * transparent Modal on Android that child can end up with no layout and
 * never paint, which is exactly how the dim silently goes missing. The
 * root always gets full-screen layout, so it always paints; styles.backdrop
 * is now just a transparent tap-to-close target.
 * Scrim opacity is not animated (native-driver + transparent Modal quirk).
 * Only the sheet translates.
 */
export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeightRatio = 0.86,
  avoidKeyboard = true,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(!!visible);
  const slideY = useRef(new Animated.Value(windowHeight)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  // Scrim alpha rides its own value: slideY/dragY are native-driven for
  // transform, and a node driven natively cannot also be read from JS.
  const scrimProgress = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!avoidKeyboard) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e?.endCoordinates?.height || 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [avoidKeyboard]);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      const id = setTimeout(() => {
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 3,
          speed: 14,
        }).start();
        Animated.timing(scrimProgress, {
          toValue: 1,
          duration: OPEN_DURATION,
          useNativeDriver: false,
        }).start();
      }, 16);
      return () => clearTimeout(id);
    } else {
      Animated.timing(scrimProgress, {
        toValue: 0,
        duration: CLOSE_DURATION,
        useNativeDriver: false,
      }).start();
      Animated.timing(slideY, {
        toValue: windowHeight,
        duration: CLOSE_DURATION,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD || g.vy > DRAG_VEL_THRESHOLD) {
          Animated.timing(scrimProgress, {
            toValue: 0,
            duration: CLOSE_DURATION,
            useNativeDriver: false,
          }).start();
          Animated.timing(dragY, {
            toValue: windowHeight,
            duration: CLOSE_DURATION,
            useNativeDriver: true,
          }).start(() => {
            slideY.setValue(windowHeight);
            dragY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  const activeMaxHeight =
    keyboardHeight > 0
      ? Math.min(windowHeight * maxHeightRatio, windowHeight - keyboardHeight - insets.top - 16)
      : windowHeight * maxHeightRatio;

  const combinedY = Animated.add(slideY, dragY);
  const scrimColor = scrimProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.scrimClear, colors.scrim],
  });

  return (
    <Modal
      visible={modalVisible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.root, { backgroundColor: scrimColor }]}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel={t("common.close")}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: activeMaxHeight,
              transform: [{ translateY: combinedY }],
              marginBottom: keyboardHeight,
            },
          ]}
        >
          <View style={styles.handleHitArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {title != null ? (
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                style={styles.closeButton}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.body}>{children}</View>

          {footer ? (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom:
                    keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 12),
                },
              ]}
            >
              {footer}
            </View>
          ) : (
            <View
              style={{
                height: keyboardHeight > 0 ? 4 : Math.max(insets.bottom, 8),
              }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  // flex:1 (not absolute fill) so it has real layout above the sheet —
  // that is what makes it both paint and receive the tap-to-close.
  backdrop: {
    flex: 1,
  },

  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0,0,0,0.14)",
    paddingTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 30,
  },

  handleHitArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#B0B8C8",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { flexShrink: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});