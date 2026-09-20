import { useEffect, useState } from "react";
import { apiFetch } from "./api";

/**
 * Module-level cache for GET /api/mobile/session, so the always-on AppHeader
 * can show the active organization on every tab without each tab firing its
 * own request. The in-flight promise is cached too, so four tabs mounting at
 * once still produce exactly one call.
 *
 * Deliberately NOT part of AuthProvider: that context owns the Firebase user
 * only, and the screens that need the FULL session payload (business profile,
 * user profile, scan) keep fetching it themselves — this is a read-only
 * convenience for chrome, not the source of truth for those screens.
 *
 * `clearOrgSession()` must be called on sign-out and after switching
 * organization, otherwise the next signed-in user would briefly see the
 * previous tenant's name in the header.
 */
let cached = null;
let inFlight = null;
const listeners = new Set();

export function clearOrgSession() {
  cached = null;
  inFlight = null;
  for (const listener of listeners) listener(null);
}

function loadOrgSession() {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = apiFetch("/api/mobile/session")
    .then((data) => {
      cached = data ?? null;
      inFlight = null;
      for (const listener of listeners) listener(cached);
      return cached;
    })
    .catch(() => {
      // Header chrome must never surface a request failure — the screen's own
      // fetch owns error reporting. Leave the cache empty so a later tab retries.
      inFlight = null;
      return null;
    });
  return inFlight;
}

function useCachedSession() {
  const [session, setSession] = useState(cached);

  useEffect(() => {
    let active = true;
    const listener = (next) => { if (active) setSession(next); };
    listeners.add(listener);
    loadOrgSession().then((data) => { if (active) setSession(data); });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  return session;
}

/** `{ organizationName, companyName }` for the header, or empty strings. */
export function useOrgSession() {
  const session = useCachedSession();
  return {
    organizationName: session?.organization?.name ?? "",
    companyName: session?.company?.name ?? "",
  };
}

/**
 * `canSee(moduleKey)` from the session's `accessibleModules`, the same list
 * the desktop sidebar filters on (org-enabled ∩ purchased, then a member's
 * view permissions, computed server-side). Entries with no module key are
 * always visible. While the list is unknown (session still loading, offline,
 * or a server too old to send it) everything is shown instead of hiding real
 * menus; every screen's own API call still enforces access either way.
 */
export function useModuleAccess() {
  const session = useCachedSession();
  const modules = Array.isArray(session?.accessibleModules) ? new Set(session.accessibleModules) : null;
  return (moduleKey) => !moduleKey || !modules || modules.has(moduleKey);
}
