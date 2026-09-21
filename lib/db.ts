import { Pool } from "pg";

/**
 * One pool for the process. Next's dev server re-evaluates modules on every edit,
 * so the pool is parked on globalThis to stop it opening a new pool each reload.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

function caCert() {
  const ca = process.env.DATABASE_CA_CERT;
  if (!ca) return undefined;
  // Accept either raw PEM or the base64 of one, so it survives any env store.
  return ca.includes("BEGIN CERTIFICATE") ? ca : Buffer.from(ca, "base64").toString("utf8");
}

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Verify the server when a CA is pinned; plain TLS otherwise (local dev).
    ssl: caCert() ? { ca: caCert(), rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

/** Every read and write in the app goes through here. One seam, one place to mock. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}
