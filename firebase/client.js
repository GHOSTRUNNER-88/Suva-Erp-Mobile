import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Same Firebase project as starterkit's shared/firebase/client.ts — same
 * config shape, same env var *names* (just EXPO_PUBLIC_ instead of
 * NEXT_PUBLIC_), so a config value can be copied verbatim between the two
 * apps. See ../vyzor-nextjs-ts-approuter/starterkit/shared/firebase/client.ts.
 *
 * `firebase/auth` v11's package resolves a React-Native-specific build under
 * Metro's bundler (confirmed against the installed @firebase/auth package —
 * it ships an index.rn.js with getReactNativePersistence), so no special
 * "firebase/auth/react-native" subpath import is needed here.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCL663Nm6jxC7mV1KyE-IrMoPc_kADXfsM",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "suva-erp.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "suva-erp",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "suva-erp.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "931668619666",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:931668619666:web:91bb1988025d2c222d114b",
};

let cachedApp = null;
let cachedAuth = null;

function getFirebaseApp() {
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

/**
 * `initializeAuth()` throws if called a second time on the same app (e.g.
 * Fast Refresh re-running this module) — `getAuth()` just returns the
 * already-initialized instance, so the second call falls back to that
 * instead of crashing on every hot reload.
 */
export function getFirebaseAuth() {
  if (!cachedAuth) {
    const app = getFirebaseApp();
    try {
      cachedAuth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      cachedAuth = getAuth(app);
    }
  }
  return cachedAuth;
}
