import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Misma política SSL que src/index.ts (DATABASE_SSL / DATABASE_SSL_CA).
function sslFromEnv() {
  if (process.env.DATABASE_SSL !== "true") {
    return undefined;
  }
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

// drizzle-kit ignora `ssl` cuando recibe `url`, así que se pasan los campos
// separados para que la política SSL llegue al driver pg.
const url = new URL(process.env.DATABASE_URL);

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
    ssl: sslFromEnv(),
  },
});
