import * as SQLite from "expo-sqlite";

const DB_NAME = "suva_erp.db";

const db = SQLite.openDatabaseSync(DB_NAME);

export function getDb() {
  return db;
}

// Every export below assumes the tables exist, but initDb() used to run only
// from a useEffect in app/_layout.js — and effects run *after* render, while
// useQueueStats() queries pending_changes during the first render of
// OfflineBanner. On a fresh install that threw "no such table:
// pending_changes" and crashed the app on its very first launch. Creating the
// schema at module load removes the ordering dependency for every caller at
// once; the statements are all IF NOT EXISTS, so this stays cheap and the
// remaining explicit initDb() calls are harmless no-ops.
initDb();

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS api_cache (
      cache_key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      last_fetched TEXT NOT NULL,
      expires_at TEXT,
      entity_type TEXT,
      entity_id TEXT,
      status_code INTEGER DEFAULT 200
    );
    CREATE TABLE IF NOT EXISTS pending_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      data TEXT,
      entity_type TEXT,
      entity_id TEXT,
      created_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cache_entity ON api_cache(entity_type);
    CREATE INDEX IF NOT EXISTS idx_pending_unsynced ON pending_changes(synced) WHERE synced = 0;
    CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_changes(created_at);
  `);
}

export function resetDb() {
  db.execSync(`
    DROP TABLE IF EXISTS api_cache;
    DROP TABLE IF EXISTS pending_changes;
    DROP TABLE IF EXISTS sync_meta;
  `);
  initDb();
}

export function getCachedResponse(cacheKey) {
  return db.getFirstSync("SELECT data, last_fetched, expires_at, status_code FROM api_cache WHERE cache_key = ?", [cacheKey]);
}

export function setCachedResponse(cacheKey, data, entityType, entityId, ttlMs) {
  const now = Date.now();
  const expiresAt = ttlMs != null ? new Date(now + ttlMs).toISOString() : null;
  db.runSync(
    "INSERT OR REPLACE INTO api_cache (cache_key, data, last_fetched, expires_at, entity_type, entity_id, status_code) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      cacheKey,
      typeof data === "string" ? data : JSON.stringify(data),
      new Date(now).toISOString(),
      expiresAt,
      entityType ?? null,
      entityId != null ? String(entityId) : null,
      200,
    ],
  );
}

export function isCacheValid(row) {
  if (!row) return false;
  if (!row.expires_at) return false;
  const expires = new Date(row.expires_at).getTime();
  return Date.now() < expires;
}

export function invalidateCache(entityType) {
  if (entityType) {
    db.runSync("DELETE FROM api_cache WHERE entity_type = ?", [entityType]);
  } else {
    db.runSync("DELETE FROM api_cache");
  }
}

export function invalidateCacheByPrefix(prefix) {
  db.runSync("DELETE FROM api_cache WHERE cache_key LIKE ?", [prefix + "%"]);
}

export function getCachedEntities(entityType) {
  const rows = db.getAllSync(
    "SELECT data FROM api_cache WHERE entity_type = ? ORDER BY last_fetched DESC LIMIT 1",
    [entityType],
  );
  if (rows.length === 0) return null;
  const json = rows[0].data;
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export function getCachedEntity(entityType, entityId) {
  const row = db.getFirstSync(
    "SELECT data FROM api_cache WHERE entity_type = ? AND entity_id = ? ORDER BY last_fetched DESC LIMIT 1",
    [entityType, String(entityId)],
  );
  if (!row) return null;
  try {
    return row.data ? JSON.parse(row.data) : null;
  } catch {
    return null;
  }
}

export function enqueueChange(method, endpoint, data, entityType, entityId) {
  const result = db.runSync(
    "INSERT INTO pending_changes (method, endpoint, data, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      method,
      endpoint,
      data != null ? JSON.stringify(data) : null,
      entityType ?? null,
      entityId != null ? String(entityId) : null,
      new Date().toISOString(),
    ],
  );
  return result?.lastInsertRowId;
}

export function getPendingChanges() {
  return db.getAllSync("SELECT * FROM pending_changes WHERE synced = 0 ORDER BY created_at ASC");
}

export function deletePendingChange(id) {
  db.runSync("DELETE FROM pending_changes WHERE id = ?", [id]);
}

export function incrementAttempts(id) {
  db.runSync(
    "UPDATE pending_changes SET attempts = attempts + 1, last_error = ? WHERE id = ?",
    [new Date().toISOString(), id],
  );
}

export function markChangeSynced(id) {
  db.runSync("UPDATE pending_changes SET synced = 1 WHERE id = ?", [id]);
}

export function getPendingCount() {
  const row = db.getFirstSync("SELECT COUNT(*) as count FROM pending_changes WHERE synced = 0");
  return row ? row.count : 0;
}

export function getFailedCount() {
  const row = db.getFirstSync("SELECT COUNT(*) as count FROM pending_changes WHERE synced = 0 AND attempts > 0");
  return row ? row.count : 0;
}

export function getQueueStats() {
  const row = db.getFirstSync(
    "SELECT COUNT(*) as pending, SUM(CASE WHEN attempts > 0 THEN 1 ELSE 0 END) as failed FROM pending_changes WHERE synced = 0",
  );
  return {
    pendingCount: row ? (row.pending || 0) : 0,
    failedCount: row ? (row.failed || 0) : 0,
  };
}

export function getSyncMeta(key) {
  const row = db.getFirstSync("SELECT value FROM sync_meta WHERE key = ?", [key]);
  return row ? row.value : null;
}

export function setSyncMeta(key, value) {
  db.runSync(
    "INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)",
    [key, String(value)],
  );
}

export function getAllCacheKeys() {
  return db.getAllSync("SELECT cache_key, entity_type, last_fetched FROM api_cache").map((r) => ({ key: r.cache_key, entityType: r.entity_type, lastFetched: r.last_fetched }));
}

export function getCacheSize() {
  const row = db.getFirstSync("SELECT COUNT(*) as count FROM api_cache");
  return row ? row.count : 0;
}

export function clearAllData() {
  db.execSync(`
    DELETE FROM api_cache;
    DELETE FROM pending_changes;
    DELETE FROM sync_meta;
  `);
}
