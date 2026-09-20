import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  AppState,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthProvider";
import { useOrgSession } from "../../lib/orgSession";
import {
  getBiometricPreference,
  getBiometricType,
  authenticateWithBiometrics,
  isBiometricsAvailable,
} from "../../lib/biometrics";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

export default function BiometricGuard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { organizationName, companyName } = useOrgSession();

  const [isLocked, setIsLocked] = useState(false);
  const [biometricType, setBiometricType] = useState("Biometrics");
  const [authError, setAuthError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const isAuthenticatingRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const isLockedRef = useRef(false);

  // Sync ref for access in event handlers
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const triggerAuth = useCallback(async () => {
    if (isAuthenticatingRef.current) return;

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const type = await getBiometricType();
      setBiometricType(type);

      const promptReason = t("biometrics.promptReason", {
        defaultValue: "Scan your fingerprint or face to access SUVA ERP",
      });

      const result = await authenticateWithBiometrics(promptReason);

      if (result && result.success) {
        setIsLocked(false);
        setAuthError(null);
      } else {
        // Did not succeed - keep locked
        if (result?.error && result.error !== "user_cancel" && result.error !== "system_cancel") {
          setAuthError(
            t("biometrics.authFailedTryAgain", {
              defaultValue: "Authentication failed. Please tap Authenticate to try again.",
            })
          );
        }
      }
    } catch (err) {
      console.warn("Error during biometric authentication:", err);
      setAuthError(
        t("biometrics.authFailedTryAgain", {
          defaultValue: "Authentication failed. Please tap Authenticate to try again.",
        })
      );
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, [t]);

  // Initial check on mount / when user changes
  useEffect(() => {
    if (!user) {
      setIsLocked(false);
      return;
    }

    let isMounted = true;
    (async () => {
      const enabled = await getBiometricPreference();
      if (!isMounted) return;

      if (enabled) {
        const available = await isBiometricsAvailable();
        if (available) {
          const type = await getBiometricType();
          if (!isMounted) return;
          setBiometricType(type);
          setIsLocked(true);
          // Automatically prompt for authentication on launch
          triggerAuth();
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, triggerAuth]);

  // Handle AppState transitions (launch or resume from background)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      const previousState = appState.current;
      appState.current = nextAppState;

      if (!user) return;

      // When app goes to background or becomes inactive
      if (nextAppState === "background" || (Platform.OS === "ios" && nextAppState === "inactive")) {
        // Only lock if not currently authenticating (e.g. system biometric prompt overlay)
        if (!isAuthenticatingRef.current) {
          const enabled = await getBiometricPreference();
          if (enabled) {
            setIsLocked(true);
          }
        }
      }

      // When app resumes to foreground
      if (
        previousState.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // If we were in the middle of a biometric check, ignore
        if (isAuthenticatingRef.current) return;

        const enabled = await getBiometricPreference();
        if (enabled) {
          setIsLocked(true);
          triggerAuth();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, triggerAuth]);

  const handleFallback = async () => {
    setIsLocked(false);
    setAuthError(null);
    try {
      await logout();
    } catch (error) {
      console.warn("Logout fallback failed:", error);
    }
  };

  if (!user || !isLocked) {
    return null;
  }

  const localizedType = (() => {
    switch (biometricType) {
      case "FaceID":
        return t("biometrics.faceId", "Face ID");
      case "TouchID":
        return t("biometrics.touchId", "Touch ID");
      case "Fingerprint":
        return t("biometrics.fingerprint", "Fingerprint");
      default:
        return t("biometrics.biometrics", "Biometrics");
    }
  })();

  const biometricIconName = biometricType === "FaceID" ? "face-recognition" : "fingerprint";
  const orgDisplayName = organizationName || companyName || "SUVA ERP";
  const userDisplayName = user.displayName || user.email || "";

  return (
    <Modal
      visible={isLocked}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {
        // Back button on Android - prompt again or stay locked
        triggerAuth();
      }}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Top Brand & Org Header */}
          <View style={styles.header}>
            <View style={styles.brandBadge}>
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={styles.brandBadgeText}>SUVA ERP</Text>
            </View>
            <Text style={styles.orgName} numberOfLines={1}>
              {orgDisplayName}
            </Text>
            {userDisplayName ? (
              <Text style={styles.userEmail} numberOfLines={1}>
                {userDisplayName}
              </Text>
            ) : null}
          </View>

          {/* Central Biometric Visual */}
          <View style={styles.centerSection}>
            <TouchableOpacity
              style={styles.iconCircle}
              activeOpacity={0.8}
              onPress={triggerAuth}
              disabled={isAuthenticating}
            >
              <MaterialCommunityIcons
                name={biometricIconName}
                size={68}
                color={colors.primary}
              />
            </TouchableOpacity>

            <Text style={styles.title}>
              {t("biometrics.unlockSuvaErp", { defaultValue: "Unlock SUVA ERP" })}
            </Text>

            <Text style={styles.subtitle}>
              {t("biometrics.lockedSubtitle", {
                defaultValue: "Verify your biometric identity to access your business data",
              })}
            </Text>

            {authError ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, isAuthenticating && styles.primaryButtonDisabled]}
              activeOpacity={0.85}
              onPress={triggerAuth}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={biometricIconName}
                    size={22}
                    color="#FFFFFF"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.primaryButtonText}>
                    {t("biometrics.authenticateWith", {
                      type: localizedType,
                      defaultValue: `Unlock with ${localizedType}`,
                    })}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fallbackButton}
              activeOpacity={0.7}
              onPress={handleFallback}
            >
              <Feather name="key" size={16} color={colors.textMuted} style={styles.buttonIcon} />
              <Text style={styles.fallbackButtonText}>
                {t("biometrics.fallbackPassword", {
                  defaultValue: "Use Password / Switch Account",
                })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bodyBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  brandBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  orgName: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
    textAlign: "center",
  },
  userEmail: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  centerSection: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 2,
    borderColor: `${colors.primary}30`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.danger,
    flexShrink: 1,
  },
  footer: {
    width: "100%",
    gap: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  buttonIcon: {
    marginRight: 8,
  },
  fallbackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallbackButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
});
