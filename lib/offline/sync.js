import { apiFetch, ApiError } from "../api";
import * as offlineDb from "./db";
import { flushQueue, schedulePushCheck, getQueueStats as getQueueStatsFromQueue, notifyStatsListeners } from "./queue";

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

const DOWNLOAD_ENDPOINTS = [
  { key: "/api/mobile/session", entityType: "session", cacheTtl: 0 },
  { key: "/api/mobile/organization", entityType: "organization", cacheTtl: 0 },
  { key: "/api/mobile/modules", entityType: "modules", cacheTtl: 60000 },
  { key: "/api/mobile/credit-terms", entityType: "credit_terms", cacheTtl: 300000 },
  { key: "/api/parties", entityType: "parties" },
  { key: "/api/party-groups", entityType: "party_groups" },
  { key: "/api/mobile/items", entityType: "items" },
  { key: "/api/mobile/item-categories", entityType: "item_categories" },
  { key: "/api/mobile/units", entityType: "units" },
  { key: "/api/mobile/warehouses", entityType: "warehouses" },
  { key: "/api/mobile/bank-accounts", entityType: "bank_accounts" },
  { key: "/api/mobile/sales-invoices", entityType: "sales_invoices" },
  { key: "/api/mobile/purchase-bills", entityType: "purchase_bills" },
  { key: "/api/mobile/expenses", entityType: "expenses" },
  { key: "/api/mobile/expense-categories", entityType: "expense_categories" },
  { key: "/api/mobile/payments?type=in", entityType: "payments_in" },
  { key: "/api/mobile/payments?type=out", entityType: "payments_out" },
  { key: "/api/mobile/credit-notes", entityType: "credit_notes" },
  { key: "/api/mobile/debit-notes", entityType: "debit_notes" },
  { key: "/api/mobile/cheques", entityType: "cheques" },
  { key: "/api/mobile/cash-transfers", entityType: "cash_transfers" },
  { key: "/api/mobile/deals", entityType: "deals" },
  { key: "/api/mobile/lead-sources", entityType: "lead_sources" },
  { key: "/api/mobile/notifications", entityType: "notifications" },
];

export function getDownloadEndpoints() {
  return DOWNLOAD_ENDPOINTS;
}

export function getCacheKey(endpoint) {
  return `api:${endpoint}`;
}

export function getQueueStats() {
  return getQueueStatsFromQueue();
}

let currentOnline = typeof navigator !== "undefined" && navigator.onLine === false ? false : true;
const networkListeners = new Set();
let monitoringStarted = false;
let pollTimer = null;
let autoSyncInProgress = false;

export function isLikelyOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  return currentOnline;
}

export function notifyNetworkListeners(status) {
  for (const listener of networkListeners) {
    try {
      listener(status);
    } catch {
      // ignore listener error
    }
  }
}

export function setNetworkStatus(online) {
  const next = Boolean(online);
  const changed = currentOnline !== next;
  const wasRestored = !currentOnline && next;
  currentOnline = next;

  if (changed) {
    notifyNetworkListeners({ isOnline: currentOnline, wasRestored });
    if (wasRestored) {
      triggerAutoSync();
    }
  }
}

export async function checkConnectivity() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://erp.suvacorp.com.np").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    // Attempt a lightweight probe. Any HTTP response code (including 200, 401, 403) confirms network reachability.
    await fetch(`${baseUrl}/api/mobile/session`, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timer);
    return true;
  } catch (err) {
    clearTimeout(timer);
    return false;
  }
}

export async function triggerAutoSync() {
  if (autoSyncInProgress) return;
  autoSyncInProgress = true;
  try {
    await flushQueue();
    await syncDelta();
  } catch (err) {
    // ignore background auto-sync failure
  } finally {
    autoSyncInProgress = false;
  }
}

export function startNetworkMonitoring(onStatusChange) {
  if (typeof onStatusChange === "function") {
    networkListeners.add(onStatusChange);
    try {
      onStatusChange({ isOnline: isLikelyOnline(), wasRestored: false });
    } catch {}
  }

  if (!monitoringStarted) {
    monitoringStarted = true;

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("online", () => setNetworkStatus(true));
      window.addEventListener("offline", () => setNetworkStatus(false));
    }

    const poll = async () => {
      try {
        const reachable = await checkConnectivity();
        setNetworkStatus(reachable);
      } catch {
        setNetworkStatus(false);
      } finally {
        if (monitoringStarted) {
          const delay = currentOnline ? 15000 : 4000;
          pollTimer = setTimeout(poll, delay);
        }
      }
    };

    pollTimer = setTimeout(poll, 1500);
  }

  return () => {
    if (onStatusChange) {
      networkListeners.delete(onStatusChange);
    }
  };
}

export function isNetworkError(error) {
  if (!error) return false;
  if (error instanceof ApiError || error.name === "ApiError") {
    if (
      error.code === "validation_error" ||
      error.code === "not_authenticated" ||
      error.code === "unauthorized" ||
      error.code === "forbidden" ||
      error.fieldErrors ||
      error.formError
    ) {
      return false;
    }
  }

  const msg = (error.message || "").toLowerCase();
  const name = (error.name || "").toLowerCase();
  if (name === "typeerror" && (msg.includes("network") || msg.includes("fetch"))) return true;
  if (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("timeout") ||
    msg.includes("aborted")
  ) {
    return true;
  }

  if (!isLikelyOnline()) return true;
  return false;
}

export async function downloadCompany(onProgress) {
  const errors = [];
  const total = DOWNLOAD_ENDPOINTS.length;

  for (let i = 0; i < total; i++) {
    const { key, entityType, cacheTtl } = DOWNLOAD_ENDPOINTS[i];
    try {
      const data = await apiFetch(key);
      const cacheKey = getCacheKey(key);
      offlineDb.setCachedResponse(cacheKey, data, entityType, null, cacheTtl ?? DEFAULT_CACHE_TTL);
      onProgress?.({ entityType, loaded: i + 1, total, status: "done" });
    } catch (error) {
      errors.push({ entityType, key, error: error.message });
      onProgress?.({ entityType, loaded: i + 1, total, status: "error", error: error.message });
    }
  }

  offlineDb.setSyncMeta("company_downloaded_at", new Date().toISOString());
  offlineDb.setSyncMeta("last_full_sync", new Date().toISOString());

  return { errors, completed: total - errors.length, total };
}

export async function syncDelta() {
  const lastSync = offlineDb.getSyncMeta("last_delta_sync");
  const since = lastSync || new Date(0).toISOString();

  try {
    const result = await apiFetch(`/api/mobile/sync?since=${encodeURIComponent(since)}`, { raw: true });

    if (result?.ok) {
      setNetworkStatus(true);
      const entities = result.data.entities || {};
      const invalidatedTypes = new Set();

      for (const [entityType, records] of Object.entries(entities)) {
        if (records && records.length > 0) {
          invalidatedTypes.add(entityType);
        }
      }

      for (const entityType of invalidatedTypes) {
        offlineDb.invalidateCache(entityType);
      }

      offlineDb.setSyncMeta("last_delta_sync", result.data.lastSync);
      return { ok: true, lastSync: result.data.lastSync, updatedTypes: Array.from(invalidatedTypes) };
    }
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
    }
    return { ok: false, error: error.message };
  }
}

export async function syncEndpoint(endpoint, entityType) {
  try {
    const data = await apiFetch(endpoint);
    setNetworkStatus(true);
    offlineDb.setCachedResponse(getCacheKey(endpoint), data, entityType, null, DEFAULT_CACHE_TTL);
    return { ok: true, data };
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
    }
    const cached = offlineDb.getCachedResponse(getCacheKey(endpoint));
    if (cached) {
      return { ok: true, data: JSON.parse(cached.data), isOffline: true };
    }
    return { ok: false, error: error.message };
  }
}

export async function fetchWithCache(endpoint, entityType, forceRefresh, ttlMs) {
  const cacheKey = getCacheKey(endpoint);

  if (!forceRefresh) {
    const cached = offlineDb.getCachedResponse(cacheKey);
    if (cached) {
      if (ttlMs != null) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Date.now() < expiresAt) {
          try {
            return { data: JSON.parse(cached.data), isOffline: false, fromCache: true };
          } catch {
            // fall through to network
          }
        }
      } else {
        try {
          return { data: JSON.parse(cached.data), isOffline: false, fromCache: true };
        } catch {
          // fall through to network
        }
      }
    }
  }

  try {
    const data = await apiFetch(endpoint);
    setNetworkStatus(true);
    offlineDb.setCachedResponse(cacheKey, data, entityType, null, ttlMs ?? DEFAULT_CACHE_TTL);
    return { data, isOffline: false, fromCache: false };
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
    }
    const cached = offlineDb.getCachedResponse(cacheKey);
    if (cached) {
      try {
        return { data: JSON.parse(cached.data), isOffline: true, fromCache: true };
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

export async function fetchEntity(endpoint, entityType, id, forceRefresh) {
  const cacheKey = `${getCacheKey(endpoint)}:${id}`;
  const cached = offlineDb.getCachedResponse(cacheKey);

  if (!forceRefresh && offlineDb.isCacheValid(cached)) {
    try {
      return { data: JSON.parse(cached.data), isOffline: false, fromCache: true };
    } catch {
      // fall through
    }
  }

  try {
    const data = await apiFetch(`${endpoint}/${id}`);
    setNetworkStatus(true);
    offlineDb.setCachedResponse(cacheKey, data, entityType, id, DEFAULT_CACHE_TTL);
    return { data, isOffline: false, fromCache: false };
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
    }
    if (cached) {
      try {
        return { data: JSON.parse(cached.data), isOffline: true, fromCache: true };
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

export async function createEntity(endpoint, entityType, payload) {
  if (!isLikelyOnline()) {
    offlineDb.enqueueChange("POST", endpoint, payload, entityType, null);
    schedulePushCheck();
    notifyStatsListeners();
    return { ok: false, data: null, queued: true, error: "offline" };
  }

  try {
    const result = await apiFetch(endpoint, { method: "POST", body: payload, raw: true });
    setNetworkStatus(true);

    try {
      offlineDb.invalidateCache(entityType);
    } catch {
      // ignore
    }

    return { ok: true, data: result };
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
      offlineDb.enqueueChange("POST", endpoint, payload, entityType, null);
      schedulePushCheck();
      notifyStatsListeners();
      return { ok: false, data: null, queued: true, error: error.message };
    }
    throw error;
  }
}

export async function updateEntity(endpoint, entityType, id, payload) {
  const target = id ? `${endpoint}/${id}` : endpoint;

  if (!isLikelyOnline()) {
    offlineDb.enqueueChange("PATCH", target, payload, entityType, id);
    schedulePushCheck();
    notifyStatsListeners();
    return { ok: false, data: null, queued: true, error: "offline" };
  }

  try {
    const result = await apiFetch(target, { method: "PATCH", body: payload, raw: true });
    setNetworkStatus(true);

    try {
      offlineDb.invalidateCache(entityType);
    } catch {
      // ignore
    }

    return { ok: true, data: result };
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
      offlineDb.enqueueChange("PATCH", target, payload, entityType, id);
      schedulePushCheck();
      notifyStatsListeners();
      return { ok: false, data: null, queued: true, error: error.message };
    }
    throw error;
  }
}

export async function deleteEntity(endpoint, entityType, id) {
  const target = id ? `${endpoint}/${id}` : endpoint;

  if (!isLikelyOnline()) {
    offlineDb.enqueueChange("DELETE", target, null, entityType, id);
    schedulePushCheck();
    notifyStatsListeners();
    return { ok: false, queued: true, error: "offline" };
  }

  try {
    await apiFetch(target, { method: "DELETE" });
    setNetworkStatus(true);

    try {
      offlineDb.invalidateCache(entityType);
    } catch {
      // ignore
    }

    return { ok: true };
  } catch (error) {
    if (isNetworkError(error)) {
      setNetworkStatus(false);
      offlineDb.enqueueChange("DELETE", target, null, entityType, id);
      schedulePushCheck();
      notifyStatsListeners();
      return { ok: false, queued: true, error: error.message };
    }
    throw error;
  }
}

export async function applyPendingChanges() {
  const pending = offlineDb.getPendingChanges();
  const results = [];

  for (const change of pending) {
    try {
      const options = {
        method: change.method,
        headers: { "Content-Type": "application/json" },
      };
      if (change.data) {
        options.body = JSON.parse(change.data);
      }

      await apiFetch(change.endpoint, options);
      offlineDb.markChangeSynced(change.id);
      results.push({ id: change.id, ok: true });
    } catch (error) {
      offlineDb.incrementAttempts(change.id);
      results.push({ id: change.id, ok: false, error: error.message });
    }
  }

  offlineDb.setSyncMeta("last_push", new Date().toISOString());
  notifyStatsListeners();
  return results;
}

export function getSyncStatus() {
  const lastFullSync = offlineDb.getSyncMeta("last_full_sync");
  const lastDeltaSync = offlineDb.getSyncMeta("last_delta_sync");
  const lastPush = offlineDb.getSyncMeta("last_push");
  const companyDownloaded = offlineDb.getSyncMeta("company_downloaded_at");
  const pendingCount = offlineDb.getPendingCount();

  return {
    lastFullSync,
    lastDeltaSync,
    lastPush,
    isDownloaded: !!companyDownloaded,
    hasPendingWrites: pendingCount > 0,
    pendingWriteCount: pendingCount,
  };
}

export function getCompanyDownloadTimestamp() {
  return offlineDb.getSyncMeta("company_downloaded_at");
}

export function setCompanyDownloadTimestamp(ts) {
  offlineDb.setSyncMeta("company_downloaded_at", ts);
}
