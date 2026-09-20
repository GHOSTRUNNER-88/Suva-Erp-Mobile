/**
 * Maps a Firebase Auth error code to an i18n key — mirrors starterkit's
 * shared/firebase/error-message.ts key-for-key (same `auth.*` keys, see
 * ../suva-erp-mobile/i18n/resources.js) so the same failure reads the same
 * on web and mobile. Signup-only codes (email-already-in-use, weak-password)
 * are intentionally omitted — this app has no signup screen.
 */
export function firebaseAuthErrorKey(error) {
  const code = error?.code;
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "auth.errWrongCredentials";
    case "auth/invalid-email":
      return "auth.emailInvalid";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
      return "auth.errNotConfigured";
    case "auth/too-many-requests":
      return "auth.errTooManyRequests";
    default:
      return "auth.errSignInFailed";
  }
}
