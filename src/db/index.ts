import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/coremenu";

const client = postgres(connectionString, {
  max: process.env.DB_MAX_CONNECTIONS ? parseInt(process.env.DB_MAX_CONNECTIONS, 10) : 10,
  idle_timeout: 20,
  connect_timeout: 3,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export * from "./schema";

let cachedDbAvailable: boolean | null = null;
let lastCheckedAt = 0;
const CACHE_TTL_MS = 30_000;
const FAILURE_CACHE_TTL_MS = 5_000;

/**
 * Tests PostgreSQL connectivity with a fast timeout and caches availability
 * so offline development, builds, and E2E runs cleanly fall back to in-memory storage.
 */
export async function checkDbConnection(): Promise<boolean> {
  if (process.env.COREMENU_USE_IN_MEMORY === "true") {
    return false;
  }

  if (process.env.NODE_ENV === "test" && !process.env.TEST_DATABASE_URL) {
    return false;
  }

  const now = Date.now();
  const ttl = cachedDbAvailable ? CACHE_TTL_MS : FAILURE_CACHE_TTL_MS;
  if (cachedDbAvailable !== null && now - lastCheckedAt < ttl) {
    return cachedDbAvailable;
  }

  try {
    await Promise.race([
      client`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DB connection check timed out")), 1500)
      ),
    ]);
    cachedDbAvailable = true;
  } catch {
    cachedDbAvailable = false;
  }

  lastCheckedAt = Date.now();
  return cachedDbAvailable;
}

export function resetDbConnectionCache(): void {
  cachedDbAvailable = null;
  lastCheckedAt = 0;
}
