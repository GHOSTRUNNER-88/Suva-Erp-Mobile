import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView, PanResponder, Animated, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import Button from "./Button";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

const DRAG_CLOSE_THRESHOLD = 80;
const DRAG_VEL_THRESHOLD = 0.6;
const OPEN_DURATION = 260;
const CLOSE_DURATION = 200;

/**
 * Bottom-sheet Modal chrome for per-screen filter fields.
 * Same scrim/animation contract as ui/BottomSheet: the scrim is painted on
 * the modal's direct child and cross-fades with the sheet's slide, and the
 * backdrop is a flex:1 box (not an absolute fill) so it both paints and
 * takes the tap-to-close. Handle pill supports drag-to-dismiss.
 */
export default function FilterSheet({ visible, onClose, title, children, onApply, onReset }) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(!!visible);
  const dragY = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(windowHeight)).current;
  const scrimProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      const id = setTimeout(() => {
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start();
        Animated.timing(scrimProgress, { toValue: 1, duration: OPEN_DURATION, useNativeDriver: false }).start();
      }, 16);
      return () => clearTimeout(id);
    }
    Animated.timing(scrimProgress, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: false }).start();
    Animated.timing(slideY, { toValue: windowHeight, duration: CLOSE_DURATION, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setModalVisible(false);
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) dragY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DRAG_CLOSE_THRESHOLD || gesture.vy > DRAG_VEL_THRESHOLD) {
          Animated.timing(scrimProgress, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: false }).start();
          Animated.timing(dragY, { toValue: windowHeight, duration: CLOSE_DURATION, useNativeDriver: true }).start(() => {
            slideY.setValue(windowHeight);
            dragY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

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
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.root, { backgroundColor: scrimColor }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t("common.close")} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: Animated.add(slideY, dragY) }] }]}>
          {/* Draggable handle */}
          <View style={styles.handleHitArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel={t("common.close")}>
              <Feather name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          <View style={styles.footer}>
            <Button label={t("common.reset")} variant="secondary" onPress={onReset} style={styles.footerButton} />
            <Button label={t("common.apply")} variant="primary" onPress={onApply} style={styles.footerButton} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0,0,0,0.14)",
    paddingHorizontal: 16,
    paddingTop: 4,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 28,
  },
  handleHitArea: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#B0B8C8" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 12, paddingTop: 12 },
  footer: { flexDirection: "row", gap: 10, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  footerButton: { flex: 1 },
});