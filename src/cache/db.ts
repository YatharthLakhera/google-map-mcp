import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const DB_PATH =
  process.env.CACHE_DB_PATH ||
  path.join(os.homedir(), ".google-map-mcp", "cache.db");

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS place_details (
    place_id TEXT PRIMARY KEY,
    data     TEXT    NOT NULL,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS place_photos (
    place_id TEXT PRIMARY KEY,
    photos   TEXT    NOT NULL,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rate_limit (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    window_start INTEGER NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0
  );
`);

const TTL = parseInt(process.env.CACHE_TTL_SECONDS ?? "604800", 10);
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY ?? "1000", 10);
const WINDOW_SECONDS = 24 * 60 * 60;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function getCachedDetails(placeId: string): unknown | null {
  const row = db
    .prepare("SELECT data, fetched_at FROM place_details WHERE place_id = ?")
    .get(placeId) as { data: string; fetched_at: number } | undefined;

  if (!row || now() - row.fetched_at > TTL) return null;
  return JSON.parse(row.data);
}

export function setCachedDetails(placeId: string, data: unknown): void {
  db.prepare(
    "INSERT OR REPLACE INTO place_details (place_id, data, fetched_at) VALUES (?, ?, ?)"
  ).run(placeId, JSON.stringify(data), now());
}

export function getCachedPhotos(placeId: string): unknown[] | null {
  const row = db
    .prepare("SELECT photos, fetched_at FROM place_photos WHERE place_id = ?")
    .get(placeId) as { photos: string; fetched_at: number } | undefined;

  if (!row || now() - row.fetched_at > TTL) return null;
  return JSON.parse(row.photos);
}

export function setCachedPhotos(placeId: string, photos: unknown[]): void {
  db.prepare(
    "INSERT OR REPLACE INTO place_photos (place_id, photos, fetched_at) VALUES (?, ?, ?)"
  ).run(placeId, JSON.stringify(photos), now());
}

export function getCacheStats(): {
  detailsCount: number;
  photosCount: number;
  dbPath: string;
  ttlDays: number;
} {
  const detailsCount = (
    db.prepare("SELECT COUNT(*) AS c FROM place_details").get() as { c: number }
  ).c;
  const photosCount = (
    db.prepare("SELECT COUNT(*) AS c FROM place_photos").get() as { c: number }
  ).c;
  return { detailsCount, photosCount, dbPath: DB_PATH, ttlDays: TTL / 86400 };
}

export function clearExpiredCache(): {
  deletedDetails: number;
  deletedPhotos: number;
} {
  const cutoff = now() - TTL;
  const deletedDetails = (
    db
      .prepare("DELETE FROM place_details WHERE fetched_at < ?")
      .run(cutoff) as Database.RunResult
  ).changes;
  const deletedPhotos = (
    db
      .prepare("DELETE FROM place_photos WHERE fetched_at < ?")
      .run(cutoff) as Database.RunResult
  ).changes;
  return { deletedDetails, deletedPhotos };
}

export function getRateLimitStatus(): {
  count: number;
  limit: number;
  remaining: number;
  windowStart: number;
  resetsAt: string;
} {
  const n = now();
  const row = db
    .prepare("SELECT window_start, count FROM rate_limit WHERE id = 1")
    .get() as { window_start: number; count: number } | undefined;

  const isExpired = !row || n - row.window_start >= WINDOW_SECONDS;
  const count = isExpired ? 0 : row!.count;
  const windowStart = isExpired ? n : row!.window_start;
  const resetsAt = new Date((windowStart + WINDOW_SECONDS) * 1000).toISOString();

  return { count, limit: RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - count), windowStart, resetsAt };
}

// Atomically check the rate limit and increment if within budget.
// Throws with a human-readable message if the limit is exceeded.
export function checkAndIncrementRateLimit(): void {
  const n = now();

  const increment = db.transaction(() => {
    const row = db
      .prepare("SELECT window_start, count FROM rate_limit WHERE id = 1")
      .get() as { window_start: number; count: number } | undefined;

    if (!row || n - row.window_start >= WINDOW_SECONDS) {
      db.prepare(
        "INSERT OR REPLACE INTO rate_limit (id, window_start, count) VALUES (1, ?, 1)"
      ).run(n);
      return;
    }

    if (row.count >= RATE_LIMIT) {
      const resetsAt = new Date((row.window_start + WINDOW_SECONDS) * 1000).toISOString();
      throw new Error(
        `Rate limit exceeded: ${RATE_LIMIT} API calls per 24 h. Window resets at ${resetsAt}. ` +
        `Used ${row.count}/${RATE_LIMIT}. Override with RATE_LIMIT_PER_DAY env var.`
      );
    }

    db.prepare("UPDATE rate_limit SET count = count + 1 WHERE id = 1").run();
  });

  increment();
}
