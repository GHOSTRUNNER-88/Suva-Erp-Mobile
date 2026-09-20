import { apiFetch } from "../api";
import * as offlineDb from "./db";

let pushTimer = null;
let isSyncing = false;
const statsListeners = new Set();

export function notifyStatsListeners() {
  const stats = getQueueStats();
  for (const listener of statsListeners) {
    try {
      listener(stats);
    } catch {
      // ignore
    }
  }
}

export function subscribeQueueStats(listener) {
  if (typeof listener === "function") {
    statsListeners.add(listener);
    try {
      listener(getQueueStats());
    } catch {}
    return () => {
      statsListeners.delete(listener);
    };
  }
  return () => {};
}

export function getQueueStats() {
  const dbStats = offlineDb.getQueueStats();
  return {
    pendingCount: dbStats.pendingCount,
    failedCount: dbStats.failedCount,
    isSyncing,
  };
}

export async function enqueueChange(method, endpoint, data, entityType, entityId) {
  const id = offlineDb.enqueueChange(method, endpoint, data, entityType, entityId);
  notifyStatsListeners();
  return id;
}

export function getQueuedWrites() {
  return offlineDb.getPendingChanges();
}

export function getQueuedWriteCount() {
  return offlineDb.getPendingCount();
}

export function schedulePushCheck() {
  if (pushTimer != null) return;
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    await flushQueue();
  }, 5000);
}

export function clearPushTimer() {
  if (pushTimer != null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

export async function flushQueue() {
  clearPushTimer();

  if (isSyncing) {
    const empty = [];
    empty.pushed = 0;
    empty.failed = 0;
    return empty;
  }

  isSyncing = true;
  notifyStatsListeners();

  const pending = offlineDb.getPendingChanges();
  if (pending.length === 0) {
    isSyncing = false;
    notifyStatsListeners();
    const empty = [];
    empty.pushed = 0;
    empty.failed = 0;
    return empty;
  }

  let pushed = 0;
  let failed = 0;
  const entityTypesToInvalidate = new Set();
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
      pushed++;
      results.push({ id: change.id, ok: true });

      if (change.entity_type) {
        entityTypesToInvalidate.add(change.entity_type);
      }
    } catch (error) {
      failed++;
      offlineDb.incrementAttempts(change.id);
      results.push({ id: change.id, ok: false, error: error?.message });
    }
  }

  for (const entityType of entityTypesToInvalidate) {
    try {
      offlineDb.invalidateCache(entityType);
    } catch {
      // ignore cache invalidation failures
    }
  }

  if (pushed > 0) {
    offlineDb.setSyncMeta("last_push", new Date().toISOString());
  }

  isSyncing = false;
  notifyStatsListeners();

  // Attach pushed and failed counts so both Array and Object consumers work seamlessly
  results.pushed = pushed;
  results.failed = failed;
  return results;
}

export async function forceFlushQueue() {
  return flushQueue();
}

export async function pushChangeNow(change) {
  try {
    const options = { method: change.method };
    if (change.data) {
      options.body = JSON.parse(change.data);
    }
    await apiFetch(change.endpoint, options);
    offlineDb.markChangeSynced(change.id);
    notifyStatsListeners();
    return { ok: true };
  } catch (error) {
    offlineDb.incrementAttempts(change.id);
    notifyStatsListeners();
    return { ok: false, error: error.message };
  }
}
