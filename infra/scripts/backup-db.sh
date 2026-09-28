#!/usr/bin/env bash
# Nightly PostgreSQL backup (cron, see bootstrap-server.sh). Keeps 14 days in /opt/najme/backups.
set -euo pipefail

cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
source .env
set +a

mkdir -p backups
file="backups/najme-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

docker compose -f compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip >"$file.tmp"
mv "$file.tmp" "$file"

find backups -name 'najme-*.sql.gz' -mtime +14 -delete
echo "backup: wrote $file"
