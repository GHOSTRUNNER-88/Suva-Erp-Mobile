import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nextProvider } from "react-i18next";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import i18n from "../i18n";
import { restoreLanguage } from "../i18n/language";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { useTranslation } from "react-i18next";
import { hasSeenOnboarding } from "../lib/onboarding";
import { registerForPushNotifications, registerNotificationResponseHandling } from "../lib/pushNotifications";
import { checkForNewModule } from "../lib/moduleTourTracker";
import { apiFetch } from "../lib/api";
import { initDb } from "../lib/offline/db";
import { flushQueue, schedulePushCheck } from "../lib/offline/queue";
import { startNetworkMonitoring } from "../lib/offline/sync";
import { ToastProvider, useToast } from "../components/ui/Toast";
import OfflineBanner from "../components/ui/OfflineBanner";
import BiometricGuard from "../components/auth/BiometricGuard";
import { initCrashlytics, setCrashlyticsUser } from "../firebase/crashlytics";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialize Firebase Crashlytics reporting
initCrashlytics().catch(() => {});

function RootNavigator() {
  const { user, loading: authLoading, onboardingCompleted } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [languageReady, setLanguageReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });

  useEffect(() => {
    restoreLanguage().finally(() => setLanguageReady(true));
  }, []);

  // Checked once per sign-in (not per render) — a logout->login cycle with a
  // different account must re-check, since onboarding is scoped per uid.
  useEffect(() => {
    if (!user) {
      setOnboardingChecked(!authLoading);
      return;
    }
    let cancelled = false;
    setOnboardingChecked(false);
    hasSeenOnboarding(user.uid).then((seen) => {
      if (cancelled) return;
      setNeedsOnboarding(!seen);
      setOnboardingChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, authLoading]);

  const ready = fontsLoaded && languageReady && !authLoading && onboardingChecked;
  const showOnboarding = needsOnboarding && !onboardingCompleted;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Fire-and-forget — must never gate `ready`/the splash screen. A denied
  // permission or a failed Expo push registration is not a reason to block
  // the rest of the app.
  useEffect(() => {
    if (user) {
      registerForPushNotifications();
      setCrashlyticsUser(user).catch(() => {});
    }
  }, [user?.uid]);

  // Tap-to-navigate — separate from registration above (this listens for
  // taps regardless of whether *this* device session was the one that
  // registered the token; a token registered days ago on this same device
  // still needs its taps routed today). Only wired once signed in, same
  // "must never block startup" posture as push registration.
  useEffect(() => {
    if (!user) return;
    return registerNotificationResponseHandling();
  }, [user?.uid]);

  // Initialize offline DB, attempt push, and monitor connectivity
  useEffect(() => {
    if (!user) return;
    initDb();
    schedulePushCheck();
    const stopMonitoring = startNetworkMonitoring();
    return () => {
      stopMonitoring?.();
    };
  }, [user?.uid]);

  // "Even on new module add" — mobile's equivalent of starterkit's
  // shared/tour/ModuleAddedTourTrigger.tsx (see lib/moduleTourTracker.js's
  // doc comment for why a toast, not a spotlight, is the honest port of
  // that to React Native). Fire-and-forget, same posture as push
  // registration above — a failed modules fetch here must never block
  // anything else.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch("/api/mobile/modules")
      .then((data) => {
        const enabledKeys = (data ?? []).filter((mod) => mod.enabled).map((mod) => mod.key);
        return checkForNewModule(user.uid, enabledKeys).then((newKey) => {
          if (cancelled || !newKey) return;
          const catalogEntry = (data ?? []).find((mod) => mod.key === newKey);
          const label = catalogEntry ? t(catalogEntry.labelKey, { defaultValue: newKey }) : newKey;
          showToast(t("modules.newModuleToast", { module: label }), "success");
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Protected guard={!!user && showOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !showOnboarding}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="coming-soon" options={{ presentation: "card" }} />
        <Stack.Screen name="notifications" options={{ presentation: "card" }} />
        <Stack.Screen name="tutorial" options={{ presentation: "card" }} />
        <Stack.Screen name="business-profile" options={{ presentation: "card" }} />
        <Stack.Screen name="organization-settings" options={{ presentation: "card" }} />
        <Stack.Screen name="profile" options={{ presentation: "card" }} />
        <Stack.Screen name="settings" options={{ presentation: "card" }} />
        <Stack.Screen name="offline-manager" options={{ presentation: "card" }} />
        <Stack.Screen name="reports/index" options={{ presentation: "card" }} />
        <Stack.Screen name="reports/[slug]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales/index" options={{ presentation: "card" }} />
        <Stack.Screen name="sales/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales/new" options={{ presentation: "card" }} />
        <Stack.Screen name="sales/report" options={{ presentation: "card" }} />
        <Stack.Screen name="items/new" options={{ presentation: "card" }} />
        <Stack.Screen name="items/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="items/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="items/stock-summary" options={{ presentation: "card" }} />
        <Stack.Screen name="purchases/index" options={{ presentation: "card" }} />
        <Stack.Screen name="purchases/new" options={{ presentation: "card" }} />
        <Stack.Screen name="purchases/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="purchases/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="expenses/index" options={{ presentation: "card" }} />
        <Stack.Screen name="expenses/new" options={{ presentation: "card" }} />
        <Stack.Screen name="expenses/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="deals/index" options={{ presentation: "card" }} />
        <Stack.Screen name="deals/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="deals/new" options={{ presentation: "card" }} />
        <Stack.Screen name="scan" options={{ presentation: "card" }} />
        <Stack.Screen name="store/modules" options={{ presentation: "card" }} />
        <Stack.Screen name="store/woocommerce-orders" options={{ presentation: "card" }} />
        <Stack.Screen name="parties/index" options={{ presentation: "card" }} />
        <Stack.Screen name="parties/new" options={{ presentation: "card" }} />
        <Stack.Screen name="parties/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="parties/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="bank-accounts/index" options={{ presentation: "card" }} />
        <Stack.Screen name="payments/index" options={{ presentation: "card" }} />
        <Stack.Screen name="payments/new" options={{ presentation: "card" }} />
        <Stack.Screen name="credit-notes/new" options={{ presentation: "card" }} />
        <Stack.Screen name="debit-notes/new" options={{ presentation: "card" }} />
        <Stack.Screen name="credit-notes/index" options={{ presentation: "card" }} />
        <Stack.Screen name="debit-notes/index" options={{ presentation: "card" }} />
        <Stack.Screen name="credit-notes/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="debit-notes/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="credit-notes/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="debit-notes/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-orders/index" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-orders/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-orders/new" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-orders/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-quotations/index" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-quotations/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-quotations/new" options={{ presentation: "card" }} />
        <Stack.Screen name="sales-quotations/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="delivery-challans/index" options={{ presentation: "card" }} />
        <Stack.Screen name="delivery-challans/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="delivery-challans/new" options={{ presentation: "card" }} />
        <Stack.Screen name="delivery-challans/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="purchase-orders/index" options={{ presentation: "card" }} />
        <Stack.Screen name="purchase-orders/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="purchase-orders/new" options={{ presentation: "card" }} />
        <Stack.Screen name="purchase-orders/edit/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="inventory/adjustments/index" options={{ presentation: "card" }} />
        <Stack.Screen name="inventory/adjustments/new" options={{ presentation: "card" }} />
        <Stack.Screen name="inventory/transfers/index" options={{ presentation: "card" }} />
        <Stack.Screen name="inventory/transfers/new" options={{ presentation: "card" }} />
        <Stack.Screen name="cheques/index" options={{ presentation: "card" }} />
        <Stack.Screen name="cheques/new" options={{ presentation: "card" }} />
        <Stack.Screen name="cash-transfers/index" options={{ presentation: "card" }} />
        <Stack.Screen name="cash-transfers/new" options={{ presentation: "card" }} />
        <Stack.Screen name="parties/dues" options={{ presentation: "card" }} />
        <Stack.Screen name="party-groups/index" options={{ presentation: "card" }} />
        <Stack.Screen name="parties/[id]/statement" options={{ presentation: "card" }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
    {user ? <OfflineBanner floating={true} /> : null}
  </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Android is edge-to-edge from SDK 54 on: the status bar is drawn over
          the page and `backgroundColor`/`translucent` no longer exist as props
          (expo-status-bar only takes animated/hidden/hideTransitionAnimation/
          style). They were being silently ignored, so "light" was painting
          white icons onto colors.bodyBg (#F8F9FD) — invisible. Every screen
          sits on that light ground, and userInterfaceStyle is pinned to light,
          so dark icons are the correct fixed choice. */}
      <StatusBar style="dark" />
      <ToastProvider>
        <I18nextProvider i18n={i18n}>
          <AuthProvider>
            <RootNavigator />
            <BiometricGuard />
          </AuthProvider>
        </I18nextProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
