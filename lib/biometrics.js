import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BIOMETRIC_PREFERENCE_KEY = "@suva_biometric_enabled";

/**
 * Checks if the device has biometric hardware support and has enrolled biometrics.
 * @returns {Promise<boolean>}
 */
export async function isBiometricsAvailable() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return false;

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return Array.isArray(types) && types.length > 0;
  } catch (error) {
    console.warn("Biometrics availability check failed:", error);
    return false;
  }
}

/**
 * Returns the primary biometric authentication type available on the device:
 * "FaceID", "TouchID", "Fingerprint", or "Biometrics".
 * @returns {Promise<"FaceID" | "TouchID" | "Fingerprint" | "Biometrics">}
 */
export async function getBiometricType() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (!types || types.length === 0) return "Biometrics";

    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

    if (Platform.OS === "ios") {
      if (hasFace) return "FaceID";
      if (hasFingerprint) return "TouchID";
    } else {
      if (hasFace && !hasFingerprint) return "FaceID";
      if (hasFingerprint) return "Fingerprint";
    }

    return "Biometrics";
  } catch (error) {
    console.warn("Failed to get biometric type:", error);
    return "Biometrics";
  }
}

/**
 * Triggers biometric prompt via LocalAuthentication.authenticateAsync.
 * @param {string} reason - Prompt message displayed to user
 * @param {object} [options] - Optional overrides for authenticateAsync
 * @returns {Promise<LocalAuthentication.LocalAuthenticationResult>}
 */
export async function authenticateWithBiometrics(reason = "Unlock SUVA ERP", options = {}) {
  try {
    return await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
      ...options,
    });
  } catch (error) {
    console.warn("Biometric authentication error:", error);
    return {
      success: false,
      error: error?.message || "authentication_failed",
    };
  }
}

/**
 * Reads user biometric preference from AsyncStorage.
 * @returns {Promise<boolean>}
 */
export async function getBiometricPreference() {
  try {
    const val = await AsyncStorage.getItem(BIOMETRIC_PREFERENCE_KEY);
    return val === "true";
  } catch (error) {
    console.warn("Failed to read biometric preference:", error);
    return false;
  }
}

/**
 * Saves user biometric preference boolean to AsyncStorage.
 * @param {boolean} enabled
 * @returns {Promise<boolean>}
 */
export async function setBiometricPreference(enabled) {
  try {
    await AsyncStorage.setItem(BIOMETRIC_PREFERENCE_KEY, enabled ? "true" : "false");
    return true;
  } catch (error) {
    console.warn("Failed to save biometric preference:", error);
    return false;
  }
}
