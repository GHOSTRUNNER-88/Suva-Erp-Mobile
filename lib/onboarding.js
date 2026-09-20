import AsyncStorage from "@react-native-async-storage/async-storage";

/** Scoped per Firebase uid (not per-device) — a shared device shouldn't re-show the tutorial to a user who's already dismissed it, but a second person signing in on the same phone should still see it once. */
function key(uid) {
  return `suva.onboardingSeen.${uid}`;
}

export async function hasSeenOnboarding(uid) {
  const stored = await AsyncStorage.getItem(key(uid));
  return stored === "1";
}

export async function markOnboardingSeen(uid) {
  await AsyncStorage.setItem(key(uid), "1");
}
