import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests notification permissions, retrieves Expo push token,
 * sets up Android channels, and registers token with backend API.
 */
export async function registerForPushNotificationsAsync() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return { ok: false, status: finalStatus };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default Notifications",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0066CC",
      });
    }

    let token = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData?.data;
    } catch (e) {
      // In simulator / test environments where push token isn't generated
      console.log("[notifications] Could not get push token", e?.message);
    }

    if (token) {
      try {
        await apiFetch("/api/mobile/notifications/push-token", {
          method: "POST",
          body: JSON.stringify({ token, platform: Platform.OS }),
        });
      } catch (err) {
        console.warn("[notifications] failed to sync token to backend", err);
      }
    }

    return { ok: true, status: finalStatus, token };
  } catch (err) {
    console.warn("[notifications] registration error", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Fires an immediate local notification (used for testing or in-app alerts).
 */
export async function sendLocalTestNotification(
  title = "Suva ERP Alert",
  body = "Mobile notifications are active and configured!",
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn("[notifications] test notification failed", error);
    return false;
  }
}

