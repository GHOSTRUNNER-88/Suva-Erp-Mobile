import { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Vibration,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

const RETICLE_SIZE = 260;
const DEBOUNCE_MS = 1200;
const BARCODE_TYPES = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"];

export default function BarcodeCameraModal({
  visible,
  onClose,
  items = [],
  onItemScanned,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [banner, setBanner] = useState(null); // { type: 'success' | 'error', text: string }
  const [scannedCount, setScannedCount] = useState(0);

  const lastScanTimeRef = useRef(0);
  const bannerTimerRef = useRef(null);
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Animate laser sweep line inside reticle
  useEffect(() => {
    if (!visible) {
      setTorchOn(false);
      setShowManualInput(false);
      setBanner(null);
      setScannedCount(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: RETICLE_SIZE - 4,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [visible, laserAnim]);

  // Clear banner timeout on unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const showFeedback = useCallback((type, text) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner({ type, text });
    bannerTimerRef.current = setTimeout(() => {
      setBanner(null);
    }, 2200);
  }, []);

  const matchItemByCode = useCallback(
    (rawCode) => {
      if (!rawCode) return null;
      const normalized = String(rawCode).trim().toLowerCase();
      return (
        items.find((item) => {
          if (!item) return false;
          const b = String(item.barcodeValue || "").trim().toLowerCase();
          const id = String(item.id || "").trim().toLowerCase();
          const code = String(item.code || "").trim().toLowerCase();
          const sku = String(item.sku || "").trim().toLowerCase();
          return b === normalized || id === normalized || code === normalized || sku === normalized;
        }) ?? null
      );
    },
    [items]
  );

  const handleProcessCode = useCallback(
    (code) => {
      const trimmed = String(code || "").trim();
      if (!trimmed) return;

      const matched = matchItemByCode(trimmed);
      if (matched) {
        try {
          Vibration.vibrate(70);
        } catch (_) {}

        setScannedCount((prev) => prev + 1);
        if (onItemScanned) {
          onItemScanned(matched);
        }
        showFeedback(
          "success",
          t("barcode.scannedSuccess", {
            name: matched.name || trimmed,
            defaultValue: `Scanned: ${matched.name || trimmed}`,
          })
        );
      } else {
        try {
          Vibration.vibrate([0, 50, 50, 50]);
        } catch (_) {}

        showFeedback(
          "error",
          t("barcode.itemNotFound", {
            code: trimmed,
            defaultValue: `No item found for barcode "${trimmed}"`,
          })
        );
      }
    },
    [matchItemByCode, onItemScanned, showFeedback, t]
  );

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (!data) return;
      const now = Date.now();
      if (now - lastScanTimeRef.current < DEBOUNCE_MS) return;
      lastScanTimeRef.current = now;

      handleProcessCode(data);
    },
    [handleProcessCode]
  );

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    handleProcessCode(manualCode.trim());
    setManualCode("");
  };

  const isGranted = Boolean(permission?.granted);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {isGranted ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : null}

        {/* Viewfinder Scrim Overlay (when permission granted) */}
        {isGranted ? (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {/* Top Scrim */}
            <View style={styles.scrimTop} />

            {/* Middle Row with Cutout */}
            <View style={styles.scrimMiddleRow}>
              <View style={styles.scrimSide} />

              {/* Reticle Target Frame */}
              <View style={styles.reticleContainer}>
                {/* Corner reticle brackets */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />

                {/* Animated laser line */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    {
                      transform: [{ translateY: laserAnim }],
                    },
                  ]}
                />
              </View>

              <View style={styles.scrimSide} />
            </View>

            {/* Bottom Scrim */}
            <View style={styles.scrimBottom} />
          </View>
        ) : null}

        {/* Top Header Bar */}
        <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 24) }]}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("barcode.close", { defaultValue: "Close" })}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t("barcode.title", { defaultValue: "Scan Barcode" })}</Text>
            {scannedCount > 0 ? (
              <Text style={styles.headerSubtitle}>
                {t("barcode.itemsCount", {
                  count: scannedCount,
                  defaultValue: `${scannedCount} scanned`,
                })}
              </Text>
            ) : null}
          </View>

          {isGranted ? (
            <Pressable
              onPress={() => setTorchOn((prev) => !prev)}
              style={({ pressed }) => [
                styles.iconButton,
                torchOn && styles.iconButtonActive,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={torchOn ? t("barcode.torchOff") : t("barcode.torchOn")}
            >
              <Feather name={torchOn ? "zap" : "zap-off"} size={20} color={torchOn ? colors.gold : "#FFFFFF"} />
            </Pressable>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>

        {/* Transient Floating Feedback Banner */}
        {banner ? (
          <View style={[styles.bannerContainer, { top: Math.max(insets.top + 70, 86) }]}>
            <View
              style={[
                styles.bannerCard,
                banner.type === "success" ? styles.bannerSuccess : styles.bannerError,
              ]}
            >
              <Feather
                name={banner.type === "success" ? "check-circle" : "alert-circle"}
                size={18}
                color={banner.type === "success" ? colors.success : colors.danger}
              />
              <Text style={styles.bannerText} numberOfLines={2}>
                {banner.text}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Fallback Card if Camera Permission is not granted */}
        {!isGranted ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.permissionContainer}
          >
            <View style={styles.permissionCard}>
              <View style={styles.permissionIconBadge}>
                <Feather name="camera-off" size={36} color={colors.primary} />
              </View>

              <Text style={styles.permissionTitle}>
                {t("barcode.permissionTitle", { defaultValue: "Camera Access Required" })}
              </Text>

              <Text style={styles.permissionBody}>
                {t("barcode.permissionBody", {
                  defaultValue: "SUVA ERP needs camera access to scan product barcodes directly into documents.",
                })}
              </Text>

              <Pressable
                onPress={requestPermission}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
              >
                <Feather name="camera" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {t("barcode.grantPermission", { defaultValue: "Grant Permission" })}
                </Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  {t("barcode.manualEntry", { defaultValue: "Or enter barcode manually" })}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Manual Input in fallback */}
              <View style={styles.manualInputRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder={t("barcode.manualPlaceholder", {
                    defaultValue: "Enter barcode or item code...",
                  })}
                  placeholderTextColor={colors.textMuted}
                  value={manualCode}
                  onChangeText={setManualCode}
                  onSubmitEditing={handleManualSubmit}
                  returnKeyType="done"
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={handleManualSubmit}
                  style={({ pressed }) => [styles.manualAddButton, pressed && styles.buttonPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.manualAddButtonText}>
                    {t("barcode.addItem", { defaultValue: "Add" })}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* Bottom Control Dock (when camera active) */
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
          >
            {/* Viewfinder Hint */}
            <Text style={styles.hintText}>
              {t("barcode.hint", { defaultValue: "Align barcode or QR code within the frame" })}
            </Text>

            {/* Manual entry toggle or input form */}
            {showManualInput ? (
              <View style={styles.activeManualRow}>
                <TextInput
                  style={styles.activeManualInput}
                  placeholder={t("barcode.manualPlaceholder", {
                    defaultValue: "Enter barcode or item code...",
                  })}
                  placeholderTextColor={colors.textMuted}
                  value={manualCode}
                  onChangeText={setManualCode}
                  onSubmitEditing={handleManualSubmit}
                  returnKeyType="done"
                  autoFocus
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={handleManualSubmit}
                  style={({ pressed }) => [styles.manualAddButton, pressed && styles.buttonPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.manualAddButtonText}>
                    {t("barcode.addItem", { defaultValue: "Add" })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowManualInput(false);
                    setManualCode("");
                  }}
                  style={styles.cancelManualButton}
                  accessibilityRole="button"
                >
                  <Feather name="x" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowManualInput(true)}
                style={({ pressed }) => [styles.toggleManualButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
              >
                <Feather name="edit-2" size={14} color="#FFFFFF" />
                <Text style={styles.toggleManualText}>
                  {t("barcode.manualEntry", { defaultValue: "Enter Barcode Manually" })}
                </Text>
              </Pressable>
            )}

            {/* Done Action Button */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.doneButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
            >
              <Feather name="check" size={16} color="#FFFFFF" />
              <Text style={styles.doneButtonText}>{t("barcode.done", { defaultValue: "Done" })}</Text>
            </Pressable>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrimTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scrimMiddleRow: {
    flexDirection: "row",
    height: RETICLE_SIZE,
  },
  scrimSide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scrimBottom: {
    flex: 1.4,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  reticleContainer: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    position: "relative",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  laserLine: {
    width: RETICLE_SIZE,
    height: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 20,
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    backgroundColor: "rgba(247,181,0,0.25)",
    borderWidth: 1,
    borderColor: colors.gold,
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  bannerContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 30,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  bannerSuccess: {
    backgroundColor: "#011A42",
    borderWidth: 1,
    borderColor: colors.success,
  },
  bannerError: {
    backgroundColor: "#011A42",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#FFFFFF",
    flexShrink: 1,
  },
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 20,
  },
  hintText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 16,
  },
  toggleManualButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 14,
  },
  toggleManualText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#FFFFFF",
  },
  activeManualRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 14,
    gap: 8,
  },
  activeManualInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  manualAddButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  manualAddButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  cancelManualButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    width: "100%",
    height: 48,
    borderRadius: 12,
  },
  doneButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  permissionIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permissionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  permissionBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    width: "100%",
    height: 46,
    borderRadius: 10,
  },
  primaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSubtle,
    marginHorizontal: 10,
  },
  manualInputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 8,
  },
  manualInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
});
