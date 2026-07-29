#!/usr/bin/env bash
# EMERGENCY ONLY — prefer the Compose migrate service:
#   docker compose -f docker-compose.prod.yml up -d --build
#
# This script applies raw SQL via psql and does NOT update Drizzle's
# __drizzle_migrations journal. Using it leaves drizzle-kit migrate out of sync
# (it may try to re-apply 0000_init and fail). Only use if the migrate image is
# broken and you need tables immediately; then baseline the journal afterward.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"

echo "WARNING: emergency psql migrate — skips __drizzle_migrations tracking." >&2

for f in db/migrations/0000_init.sql db/migrations/0001_pg_trgm.sql db/migrations/0002_past_quentin_quire.sql; do
  echo "Applying $f …"
  $COMPOSE exec -T db psql -U "${POSTGRES_USER:-ourtable}" -d "${POSTGRES_DB:-ourtable}" -v ON_ERROR_STOP=1 <"$f"
done

echo "Done. Tables:"
$COMPOSE exec -T db psql -U "${POSTGRES_USER:-ourtable}" -d "${POSTGRES_DB:-ourtable}" -c '\dt'
