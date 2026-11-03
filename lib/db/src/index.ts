import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * SSL para la base de datos.
 *
 * - DATABASE_SSL no definido o "false": sin SSL (bases locales).
 * - DATABASE_SSL=true y DATABASE_SSL_CA con el certificado de la CA: SSL verificado.
 * - DATABASE_SSL=true sin DATABASE_SSL_CA: SSL cifrado sin verificar el certificado.
 *   Es el modo mínimo que suele requerir Supabase; para producción conviene
 *   usar DATABASE_SSL_CA.
 */
function sslFromEnv(): pg.PoolConfig["ssl"] {
  if (process.env.DATABASE_SSL !== "true") {
    return undefined;
  }
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
if (!Number.isInteger(poolMax) || poolMax <= 0) {
  throw new Error("DATABASE_POOL_MAX must be a positive integer.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFromEnv(),
  max: poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
