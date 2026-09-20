import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../api";
import * as offlineDb from "./db";
import { fetchWithCache, fetchEntity, getSyncStatus, isLikelyOnline, startNetworkMonitoring } from "./sync";
import { schedulePushCheck, getQueueStats, subscribeQueueStats, flushQueue } from "./queue";

const CACHE_TTL = 5 * 60 * 1000;
const ENTITY_CACHE_TTL = 30 * 60 * 1000;

export function useOfflineData(endpoint, entityType, options = {}) {
  const { forceRefresh: forceRefreshProp, ttlMs, skip } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const lastFetchRef = useRef(null);

  const fetchData = useCallback(async (force = false) => {
    if (skip) return;
    const effectiveForce = force || forceRefreshProp || false;
    const isRefresh = force && !!data;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await fetchWithCache(endpoint, entityType, effectiveForce, ttlMs ?? CACHE_TTL);
      setData(result.data);
      setIsOffline(result.isOffline || false);
      lastFetchRef.current = Date.now();
    } catch (err) {
      setError(err);
      setIsOffline(true);

      const cached = offlineDb.getCachedResponse(`api:${endpoint}`);
      if (cached) {
        try {
          setData(JSON.parse(cached.data));
        } catch {
          // no valid cache, keep error
        }
      }
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [endpoint, entityType, forceRefreshProp, ttlMs, skip, data]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return { data, loading, refreshing, error, isOffline, refetch, lastFetch: lastFetchRef.current };
}

export function useOfflineEntity(endpoint, entityType, id, options = {}) {
  const { forceRefresh: forceRefreshProp, skip } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true && !skip);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (skip || !id) {
      setLoading(false);
      return;
    }
    const effectiveForce = force || forceRefreshProp || false;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchEntity(endpoint, entityType, id, effectiveForce);
      setData(result.data);
      setIsOffline(result.isOffline || false);
    } catch (err) {
      setError(err);
      setIsOffline(true);

      const cached = offlineDb.getCachedEntity(entityType, id);
      if (cached) {
        setData(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, entityType, id, forceRefreshProp, skip]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return { data, loading, error, isOffline, refetch };
}

export function useOfflineMutation(endpoint, entityType, options = {}) {
  const { onSuccess, onError, onQueued } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (payload, method = "POST", id = null) => {
    setLoading(true);
    setError(null);

    try {
      if (isLikelyOnline()) {
        try {
          const response = await apiFetch(
            id ? `${endpoint}/${id}` : endpoint,
            { method, body: payload, raw: true },
          );
          offlineDb.invalidateCache(entityType);
          schedulePushCheck();
          onSuccess?.(response);
          return { ok: true, data: response };
        } catch (apiError) {
          if (apiError.code === "not_authenticated" || apiError.code === "unauthorized") {
            throw apiError;
          }
          offlineDb.enqueueChange(method, id ? `${endpoint}/${id}` : endpoint, payload, entityType, id);
          onQueued?.(payload);
          return { ok: false, queued: true, error: apiError.message };
        }
      } else {
        offlineDb.enqueueChange(method, id ? `${endpoint}/${id}` : endpoint, payload, entityType, id);
        onQueued?.(payload);
        return { ok: false, queued: true, error: "offline" };
      }
    } catch (err) {
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, entityType, onSuccess, onError, onQueued]);

  return { mutate, loading, error };
}

export function useQueueStats() {
  const [stats, setStats] = useState(() => getQueueStats());

  useEffect(() => {
    return subscribeQueueStats(setStats);
  }, []);

  return stats;
}

export function useSyncStatus() {
  const [status, setStatus] = useState(() => getSyncStatus());
  const [queueStats, setQueueStats] = useState(() => getQueueStats());

  const refreshStatus = useCallback(() => {
    setStatus(getSyncStatus());
    setQueueStats(getQueueStats());
  }, []);

  useEffect(() => {
    const unsubQueue = subscribeQueueStats(setQueueStats);
    const unsubNet = startNetworkMonitoring(() => {
      refreshStatus();
    });
    const interval = setInterval(refreshStatus, 15000);
    return () => {
      unsubQueue?.();
      unsubNet?.();
      clearInterval(interval);
    };
  }, [refreshStatus]);

  const sync = useCallback(async () => {
    try {
      const { syncDelta } = await import("./sync");
      const pushResult = await flushQueue();
      const deltaResult = await syncDelta();
      refreshStatus();
      return { deltaResult, pushResult };
    } finally {
      refreshStatus();
    }
  }, [refreshStatus]);

  return {
    ...status,
    ...queueStats,
    isSyncing: queueStats.isSyncing,
    sync,
    refreshStatus,
  };
}

export function useConnectivity() {
  const [online, setOnline] = useState(() => isLikelyOnline());

  useEffect(() => {
    return startNetworkMonitoring(({ isOnline }) => {
      setOnline(isOnline);
    });
  }, []);

  return { isOnline: online };
}
