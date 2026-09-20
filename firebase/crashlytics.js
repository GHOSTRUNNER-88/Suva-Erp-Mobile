import { Platform } from "react-native";
import Constants from "expo-constants";

let cached = null;

/**
 * Lazily and safely load @react-native-firebase/crashlytics.
 *
 * v26 migrated Crashlytics to TurboModules and **removed the namespaced
 * default export** — `require(...).default` is `undefined`, so the old
 * `crashlytics()` call silently produced nothing and every function here
 * became a no-op (no JS crashes, no non-fatals, no user IDs in the console).
 * Only the modular API exists now: `getCrashlytics()` plus free functions
 * that take the instance as their first argument.
 *
 * Returns `{ api, cl }` where `api` is the module namespace, or `null` when
 * the native module isn't in this binary (web, Expo Go, a dev client built
 * before the plugin was added) — that is a real fallback, not an error.
 */
function getCrashlytics() {
  if (cached) return cached;
  try {
    const api = require("@react-native-firebase/crashlytics");
    if (typeof api.getCrashlytics !== "function") {
      // The API surface moved again. Loud, because silence is what hid this for weeks.
      console.warn("[Crashlytics] @react-native-firebase/crashlytics has no getCrashlytics() — reporting is disabled.");
      return null;
    }
    cached = { api, cl: api.getCrashlytics() };
    return cached;
  } catch (err) {
    if (__DEV__) console.warn("[Crashlytics] native module unavailable:", err?.message);
  }
  return null;
}

/**
 * Whether the native Crashlytics module actually resolved in this binary.
 * Exists so a diagnostic screen can say "inactive" instead of reporting
 * success into a no-op — the exact failure mode that hid the v26 breakage.
 */
export function isCrashlyticsActive() {
  return getCrashlytics() !== null;
}

/**
 * Initialize Firebase Crashlytics on app startup.
 * Automatically enables collection and sets base device/app attributes.
 */
export async function initCrashlytics() {
  const mod = getCrashlytics();
  if (!mod) {
    return false;
  }
  const { api, cl } = mod;

  try {
    // Enable crash collection
    await api.setCrashlyticsCollectionEnabled(cl, true);

    // Set base attributes
    const appVersion = Constants.expoConfig?.version ?? "1.0.0";
    await api.setAttributes(cl, {
      app_version: String(appVersion),
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
    });

    // Wire global unhandled JS error handler
    const defaultHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
    if (ErrorUtils.setGlobalHandler) {
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        try {
          api.recordError(cl, error);
        } catch (_) {}
        if (defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
    }

    return true;
  } catch (err) {
    if (__DEV__) console.warn("[Crashlytics] init failed:", err?.message);
    return false;
  }
}

/**
 * Tag current session with the authenticated user & active workspace.
 */
export async function setCrashlyticsUser(user = {}, organizationId = null) {
  const mod = getCrashlytics();
  if (!mod) return;
  const { api, cl } = mod;

  try {
    if (user?.uid || user?.id) {
      await api.setUserId(cl, String(user.uid || user.id));
    }
    const attributes = {};
    if (user?.email) attributes.email = String(user.email);
    if (organizationId) attributes.organization_id = String(organizationId);

    if (Object.keys(attributes).length > 0) {
      await api.setAttributes(cl, attributes);
    }
  } catch (_) {}
}

/**
 * Add a breadcrumb log to Crashlytics to understand user trajectory before a crash.
 */
export function logCrashlytics(message) {
  const mod = getCrashlytics();
  if (mod) {
    try {
      mod.api.log(mod.cl, String(message));
      return;
    } catch (_) {}
  }
  if (__DEV__) {
    console.log(`[Crashlytics Log] ${message}`);
  }
}

/**
 * Record a non-fatal error to Crashlytics.
 */
export function recordCrashlyticsError(error, contextMessage = null) {
  const mod = getCrashlytics();
  if (mod) {
    const { api, cl } = mod;
    try {
      if (contextMessage) {
        api.log(cl, `Context: ${contextMessage}`);
      }
      api.recordError(cl, error instanceof Error ? error : new Error(String(error || "Unknown non-fatal error")));
      return;
    } catch (_) {}
  }
  if (__DEV__) {
    console.error(`[Crashlytics Non-Fatal]`, error, contextMessage);
  }
}

/**
 * Force a test crash to verify Crashlytics setup in the Firebase Console.
 * Call only when testing.
 */
export function testCrash() {
  const mod = getCrashlytics();
  if (mod) {
    mod.api.log(mod.cl, "Testing Crashlytics crash trigger");
    mod.api.crash(mod.cl);
  } else {
    throw new Error("Test crash: Firebase Crashlytics native module is not active.");
  }
}

