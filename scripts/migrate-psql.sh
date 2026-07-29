#!/usr/bin/env bash
# Apply SQL migrations with psql against the Compose `db` service.
# More reliable than drizzle-kit inside a one-shot container for this stack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"

for f in db/migrations/0000_init.sql db/migrations/0001_pg_trgm.sql db/migrations/0002_past_quentin_quire.sql; do
  echo "Applying $f …"
  $COMPOSE exec -T db psql -U "${POSTGRES_USER:-ourtable}" -d "${POSTGRES_DB:-ourtable}" -v ON_ERROR_STOP=1 <"$f"
done

echo "Done. Tables:"
$COMPOSE exec -T db psql -U "${POSTGRES_USER:-ourtable}" -d "${POSTGRES_DB:-ourtable}" -c '\dt'
