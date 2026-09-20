import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { apiFetch } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission, gets an Expo push token, and registers it against
 * the caller's CURRENT organization (see starterkit's app/api/mobile/
 * push-token/route.ts — tokens are per-org, not company-wide). Called once
 * per login from app/_layout.js, fire-and-forget: a denied permission or a
 * failed registration must never block the app itself, this is a
 * nice-to-have layered on top of the in-app experience, not a requirement
 * to use it.
 */
export async function registerForPushNotifications() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await apiFetch("/api/mobile/push-token", {
      method: "POST",
      body: { token, platform: Platform.OS },
    });
  } catch (error) {
    console.warn("[push] registration failed", error);
  }
}

/**
 * Tap-to-navigate — routes a notification tap to the screen for whatever
 * business event it was about, matching the `data: {type, ...id}` shape
 * every starterkit caller of notifyOrganizationDevices() already sends
 * (shared/notifications/push.ts / shared/notifications/producers.ts /
 * shared/payments/service.ts). Only `payment_in` and `invoice_overdue`
 * have a real destination screen on mobile today — `cheque_due`,
 * `b2b_order_arrived` and `b2b_payment_submitted` fall back to the in-app
 * notifications list (screens/NotificationsScreen.js) since mobile has no
 * cheque-register or B2B-order-request screens yet (desktop does; this is
 * a mobile screen-coverage gap outside this change's scope, not a push bug).
 */
function navigateForPushData(data) {
  if (!data || !data.type) return;
  switch (data.type) {
    case "salary_disbursed":
      if (data.salaryRunId) {
        router.push(`/payroll/salary-letters/${data.salaryRunId}`);
      } else {
        router.push("/payroll/salary-letters");
      }
      return;
    case "payment_in":
      router.push("/payments");
      return;
    case "invoice_overdue":
      if (data.invoiceId) {
        router.push(`/sales/${data.invoiceId}`);
        return;
      }
      break;
  }
  router.push("/notifications");
}

/**
 * Wires tap-to-navigate for both states expo-notifications distinguishes:
 * a tap while the app is foregrounded/backgrounded (the response listener
 * fires live) and a tap that cold-launched the app from killed (no live
 * event — the response is waiting in getLastNotificationResponseAsync()
 * instead). Called once from app/_layout.js, same fire-and-forget posture
 * as registerForPushNotifications: a failure here must never block
 * startup or navigation.
 */
export function registerNotificationResponseHandling() {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateForPushData(response.notification.request.content.data);
  });

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      navigateForPushData(response.notification.request.content.data);
      // Without this, the same cold-start tap would re-navigate on every
      // future call (e.g. a later logout/login re-running this effect)
      // instead of only the one time it actually happened.
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    })
    .catch((error) => console.warn("[push] getLastNotificationResponseAsync failed", error));

  return () => subscription.remove();
}
