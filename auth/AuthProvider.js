import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../firebase/client";
import { firebaseAuthErrorKey } from "../firebase/error-message";
import { signInWithGoogle, linkGoogleAccountWithPassword } from "../firebase/googleAuth";
import { recordCrashlyticsError } from "../firebase/crashlytics";
import { clearOrgSession } from "../lib/orgSession";

/**
 * A single shared Firebase auth listener for the whole app — expo-router's
 * root layout and every tab screen need the same {user, loading} state, so
 * this is a Context now instead of the old per-component hook (which would
 * have attached a duplicate onAuthStateChanged listener per caller).
 * `user` is `undefined` while still restoring the persisted session (first
 * paint), `null` once confirmed signed-out, or the Firebase user object.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) setOnboardingCompleted(false);
    });
  }, []);

  async function login(email, password) {
    const auth = getFirebaseAuth();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (error) {
      if (error?.code !== "auth/invalid-credential" && error?.code !== "auth/wrong-password" && error?.code !== "auth/user-not-found") {
        recordCrashlyticsError(error, `Firebase signInWithEmailAndPassword error: ${error?.code}`);
      }
      return { ok: false, messageKey: firebaseAuthErrorKey(error) };
    }
  }

  async function loginWithGoogle() {
    return signInWithGoogle();
  }

  async function linkGoogleAccount(email, password, pendingCredential) {
    return linkGoogleAccountWithPassword(email, password, pendingCredential);
  }

  async function logout() {
    // Drop the cached organization before the auth state flips, so the
    // always-on AppHeader can never show the previous tenant's name to
    // whoever signs in next.
    clearOrgSession();
    await signOut(getFirebaseAuth());
    // Clear the cached Google credential so the account picker always
    // appears on the next "Sign in with Google" tap (instead of silently
    // reusing the last account).
    try {
      const mod = await import("@react-native-google-signin/google-signin");
      await mod.GoogleSignin.signOut();
    } catch (_) {
      // GoogleSignin not available (Expo Go / web) — ignore.
    }
  }

  function completeOnboarding() {
    setOnboardingCompleted(true);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: user === undefined,
        onboardingCompleted,
        completeOnboarding,
        login,
        loginWithGoogle,
        linkGoogleAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}
