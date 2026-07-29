#!/usr/bin/env bash
# Daily Postgres backup for Our Table (HLD §7).
#
# Writes a compressed pg_dump into BACKUP_DIR and keeps the last RETAIN days.
# Designed for a 2-person Compose deploy — not PITR / offsite replication.
#
# Usage:
#   ./scripts/backup.sh
#   BACKUP_DIR=/var/backups/ourtable RETAIN=7 ./scripts/backup.sh
#
# Cron example (host, daily 03:15):
#   15 3 * * * cd /path/to/ourtable && ./scripts/backup.sh >>/var/log/ourtable-backup.log 2>&1
#
# Prefers `docker compose exec db` when the compose stack is up; falls back to
# local pg_dump using DATABASE_URL / PG* env vars.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETAIN="${RETAIN:-7}"
STAMP="$(date -u +%Y-%m-%d)"
OUT_FILE="$BACKUP_DIR/ourtable-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

dump_via_compose() {
  docker compose exec -T db \
    pg_dump -U "${POSTGRES_USER:-ourtable}" -d "${POSTGRES_DB:-ourtable}" \
    --no-owner --no-acl
}

dump_via_url() {
  local url="${DATABASE_URL_HOST:-${DATABASE_URL:-}}"
  if [[ -z "$url" ]]; then
    echo "error: no docker db service and DATABASE_URL / DATABASE_URL_HOST unset" >&2
    exit 1
  fi
  # pg_dump accepts a connection URI directly.
  pg_dump "$url" --no-owner --no-acl
}

if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo "Backing up via docker compose service 'db' → $OUT_FILE"
  dump_via_compose | gzip -c >"$OUT_FILE"
else
  echo "Backing up via pg_dump URI → $OUT_FILE"
  dump_via_url | gzip -c >"$OUT_FILE"
fi

# Drop dumps older than RETAIN days (by mtime).
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ourtable-*.sql.gz' -mtime +"$RETAIN" -print -delete \
  | while read -r gone; do echo "Pruned $gone"; done

echo "OK $(du -h "$OUT_FILE" | awk '{print $1}')  retained≤${RETAIN}d  dir=$BACKUP_DIR"
ls -1t "$BACKUP_DIR"/ourtable-*.sql.gz 2>/dev/null | head -n "$RETAIN" || true
