#!/usr/bin/env bash
# One-time: mark existing SQL migrations as applied in Drizzle's journal
# without re-running them. Use when tables were applied via emergency psql.
#
# Usage (on the compose host):
#   ./scripts/baseline-drizzle-journal.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"
USER_NAME="${POSTGRES_USER:-ourtable}"
DB_NAME="${POSTGRES_DB:-ourtable}"

node <<'NODE' | $COMPOSE exec -T db psql -U "$USER_NAME" -d "$DB_NAME" -v ON_ERROR_STOP=1
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const journal = JSON.parse(
  fs.readFileSync("db/migrations/meta/_journal.json", "utf8"),
);

console.log('CREATE SCHEMA IF NOT EXISTS "drizzle";');
console.log(`CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);`);

for (const entry of journal.entries) {
  const sqlPath = path.join("db/migrations", `${entry.tag}.sql`);
  const query = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(query).digest("hex");
  console.log(
    `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
     SELECT '${hash}', ${entry.when}
     WHERE NOT EXISTS (
       SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '${hash}'
     );`,
  );
}

console.log('SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at;');
NODE

echo "Baseline complete. Next: docker compose -f docker-compose.prod.yml up -d --build"
