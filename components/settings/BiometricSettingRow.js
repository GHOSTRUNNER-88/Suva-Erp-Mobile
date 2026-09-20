import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  getBiometricPreference,
  setBiometricPreference,
  isBiometricsAvailable,
  getBiometricType,
  authenticateWithBiometrics,
} from "../../lib/biometrics";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

export default function BiometricSettingRow() {
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState("Biometrics");
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [pref, type] = await Promise.all([
          getBiometricPreference(),
          getBiometricType(),
        ]);
        if (!mounted) return;
        setIsEnabled(pref);
        setBiometricType(type);
      } catch (err) {
        console.warn("Failed to load biometric settings:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = useCallback(
    async (nextValue) => {
      if (isAuthenticating) return;

      if (nextValue) {
        // User wants to turn biometrics ON
        const available = await isBiometricsAvailable();
        if (!available) {
          Alert.alert(
            t("biometrics.notAvailableTitle", { defaultValue: "Biometrics Unavailable" }),
            t("biometrics.notAvailableMessage", {
              defaultValue:
                "This device does not support biometric authentication, or no biometrics are enrolled. Please set up biometrics in device settings.",
            })
          );
          setIsEnabled(false);
          return;
        }

        setIsAuthenticating(true);
        try {
          const reason = t("biometrics.confirmEnableReason", {
            defaultValue: "Verify your identity to enable biometric login",
          });
          const result = await authenticateWithBiometrics(reason);

          if (result && result.success) {
            await setBiometricPreference(true);
            setIsEnabled(true);
          } else {
            // Cancelled or failed
            setIsEnabled(false);
          }
        } catch (err) {
          console.warn("Authentication error enabling biometrics:", err);
          setIsEnabled(false);
        } finally {
          setIsAuthenticating(false);
        }
      } else {
        // User is turning biometrics OFF
        await setBiometricPreference(false);
        setIsEnabled(false);
      }
    },
    [t, isAuthenticating]
  );

  const iconName = biometricType === "FaceID" ? "face-recognition" : "fingerprint";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Feather name="shield" size={16} color={colors.primary} style={styles.cardHeaderIcon} />
        <Text style={styles.sectionTitle}>
          {t("biometrics.security", { defaultValue: "Security" })}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.iconChip}>
          <MaterialCommunityIcons name={iconName} size={22} color={colors.primary} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {t("biometrics.enableBiometricLogin", {
              defaultValue: "Biometric Login (Face ID / Fingerprint)",
            })}
          </Text>
          <Text style={styles.subtitle}>
            {t("biometrics.enableBiometricLoginDescription", {
              defaultValue: "Use biometric security to quickly unlock SUVA ERP.",
            })}
          </Text>
        </View>

        {loading || isAuthenticating ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.switchLoader} />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            ios_backgroundColor={colors.border}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${colors.primary}12`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  switchLoader: {
    paddingHorizontal: 8,
  },
});
