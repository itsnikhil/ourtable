import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local CLI convenience. Missing `.env` is fine — Compose injects env in containers.
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Host CLI: DATABASE_URL_HOST (localhost:5433).
    // Compose migrate/app: only DATABASE_URL is set (hostname `db`).
    url:
      process.env.DATABASE_URL_HOST ??
      process.env.DATABASE_URL ??
      "postgresql://ourtable:ourtable@localhost:5433/ourtable",
  },
});
