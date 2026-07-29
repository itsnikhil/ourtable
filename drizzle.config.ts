import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Host-side migrations use localhost:5433 (compose maps db→5433).
    url:
      process.env.DATABASE_URL_HOST ??
      process.env.DATABASE_URL ??
      "postgresql://ourtable:ourtable@localhost:5433/ourtable",
  },
});
