import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, linkWithCredential } from "firebase/auth";
import { getFirebaseAuth } from "./client";
import { firebaseAuthErrorKey } from "./error-message";
import { recordCrashlyticsError } from "./crashlytics";

/**
 * Native module — requires an EAS development build, does not run in Expo
 * Go (see ../AGENTS.md Auth section). `configure()` is synchronous and must
 * run once before any sign-in call; safe to call on every app start.
 */
async function loadGoogleSignInModule() {
  try {
    return await import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

/**
 * Google idToken -> Firebase credential, same downstream session as email/
 * password sign-in (still goes through getFirebaseAuth()'s AsyncStorage
 * persistence, still lands in AuthProvider's onAuthStateChanged listener).
 * Returns {ok:false, cancelled:true} on user-initiated cancel (not an
 * error to surface), {ok:false, needsLinking:true, email, pendingCredential}
 * when this email already has a password-based Suva account (every account
 * created via the desktop app's invite/add-user flow is email/password from
 * the start — see ../AGENTS.md's Auth section) and Firebase refuses to
 * silently attach the Google identity to it, {ok:false, messageKey} on any
 * other real failure.
 */
export async function signInWithGoogle() {
  const nativeModule = await loadGoogleSignInModule();
  if (!nativeModule) return { ok: false, messageKey: "auth.errGoogleSignInUnavailable" };
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = nativeModule;
  GoogleSignin.configure({
    webClientId:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      "931668619666-9dcvjo40fb4hicnmoh5dm7qtum56cusm.apps.googleusercontent.com",
    iosClientId:
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      "931668619666-d5di27mats0vemrqj1ijlaaa1onm6jlf.apps.googleusercontent.com",
    scopes: ["profile", "email"],
    offlineAccess: true,
    forceCodeForRefreshToken: false,
  });
  let credential;
  try {
    await GoogleSignin.hasPlayServices();
    // Clear the cached Google session so the account picker appears instead
    // of silently reusing the last account.
    try { await GoogleSignin.signOut(); } catch (_) {}
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, cancelled: true };
    }

    let idToken = response.data?.idToken;
    if (!idToken) {
      try {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      } catch (tokenErr) {
        recordCrashlyticsError(tokenErr, "GoogleSignin.getTokens fallback failed");
      }
    }

    if (!idToken) {
      const err = new Error("Google Sign-In succeeded but no ID token was provided");
      recordCrashlyticsError(err, `GoogleSignin response keys: ${Object.keys(response || {}).join(", ")}`);
      return { ok: false, messageKey: "auth.errSignInFailed" };
    }

    credential = GoogleAuthProvider.credential(idToken);
  } catch (error) {
    // Android rejects a signing-certificate/OAuth-client mismatch with
    // code "10" (CommonStatusCodes.DEVELOPER_ERROR) or code "12500" (SIGN_IN_FAILED).
    const rawCode = String(error?.code ?? "");
    const rawMsg = String(error?.message ?? "");
    const isDeveloperError = rawCode === "10" || /DEVELOPER_ERROR/.test(rawMsg);
    const isSignInFailedConfig = rawCode === "12500" || /12500/.test(rawMsg);

    if (isDeveloperError || isSignInFailedConfig) {
      recordCrashlyticsError(
        error,
        `Google Sign-In Misconfiguration [code: ${rawCode}, msg: ${rawMsg}]. Check Google Play App Signing SHA-1 & Firebase Console.`
      );
      return { ok: false, messageKey: "auth.errGoogleMisconfigured", debugCode: rawCode };
    }

    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          recordCrashlyticsError(error, "Google Play Services not available");
          return { ok: false, messageKey: "auth.errPlayServicesUnavailable" };
        case statusCodes.SIGN_IN_CANCELLED:
          return { ok: false, cancelled: true };
        case statusCodes.IN_PROGRESS:
          return { ok: false, messageKey: "auth.errSignInFailed" };
        case statusCodes.NULL_PRESENTER:
        default:
          recordCrashlyticsError(error, `GoogleSignin error code: ${error.code}`);
          return { ok: false, messageKey: "auth.errSignInFailed" };
      }
    }

    recordCrashlyticsError(error, `GoogleSignin unclassified error: ${rawMsg}`);
    return { ok: false, messageKey: "auth.errSignInFailed" };
  }

  // Firebase Auth call
  try {
    await signInWithCredential(getFirebaseAuth(), credential);
    return { ok: true };
  } catch (error) {
    if (error?.code === "auth/account-exists-with-different-credential") {
      return { ok: false, needsLinking: true, email: error.customData?.email, pendingCredential: credential };
    }
    recordCrashlyticsError(error, `Firebase signInWithCredential failed: ${error?.code}`);
    return { ok: false, messageKey: firebaseAuthErrorKey(error) };
  }
}

/**
 * Completes the linking flow signInWithGoogle() above hands off to: signs
 * in with the account's existing password, then attaches the Google
 * credential to that same account so future Google Sign-In on this email
 * works directly (no repeated linking).
 */
export async function linkGoogleAccountWithPassword(email, password, pendingCredential) {
  const auth = getFirebaseAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await linkWithCredential(userCredential.user, pendingCredential);
    return { ok: true };
  } catch (error) {
    recordCrashlyticsError(error, `Firebase linkWithCredential failed: ${error?.code}`);
    return { ok: false, messageKey: firebaseAuthErrorKey(error) };
  }
}
