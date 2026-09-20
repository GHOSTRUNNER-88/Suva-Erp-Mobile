import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Mobile counterpart to starterkit's shared/tour/ModuleAddedTourTrigger.tsx
 * — same idea (diff the current module list against what this
 * account/device has seen before, surface the first newly-appeared one),
 * ported to AsyncStorage since there's no localStorage/DOM here. A full
 * DOM-measured spotlight tour doesn't translate to React Native (no
 * querySelector, no bounding-rect-of-arbitrary-element without wiring a
 * ref onto every target first) — a one-time toast is the platform-honest
 * equivalent (AGENTS.md §1: presentation may differ, the underlying
 * "notice a new module" flow doesn't).
 *
 * Scoped per Firebase uid, same reasoning as lib/onboarding.js.
 */
function key(uid) {
  return `suva.knownModules.${uid}`;
}

/**
 * Returns the key of one newly-appeared module (undefined if none), and
 * persists the new full list either way. First-ever call for an account
 * seeds silently (no toast for modules that were already there) — same
 * "don't tour-bomb an existing user" rule as the web version.
 */
export async function checkForNewModule(uid, currentEnabledKeys) {
  const stored = await AsyncStorage.getItem(key(uid));
  const known = stored ? new Set(JSON.parse(stored)) : null;
  await AsyncStorage.setItem(key(uid), JSON.stringify(currentEnabledKeys));

  if (!known) return undefined;
  return currentEnabledKeys.find((moduleKey) => !known.has(moduleKey));
}
