#!/usr/bin/env bash
# Restores a backup created by backup.sh.
#   scripts/restore.sh <backup-dir> --verify   # drill: restore into a scratch database, report, drop it (no downtime)
#   scripts/restore.sh <backup-dir>            # replace live data (asks for confirmation, stops the API meanwhile)
source "$(dirname "$0")/lib.sh"

backup="${1:?usage: scripts/restore.sh <backup-dir> [--verify]}"
mode="${2:-}"
[[ -f "$backup/postgres.dump" ]] || { echo "$backup/postgres.dump not found" >&2; exit 1; }
backup="$(cd "$backup" && pwd)"

if [[ "$mode" == "--verify" ]]; then
  scratch="restore_check_$(date -u +%s)"
  log "Restoring into scratch database $scratch"
  pg "createdb -U \"\$POSTGRES_USER\" $scratch"
  trap 'pg "dropdb -U \"\$POSTGRES_USER\" --if-exists $scratch" || true' EXIT
  pg "pg_restore -U \"\$POSTGRES_USER\" -d $scratch --no-owner --exit-on-error" < "$backup/postgres.dump"
  log "Applied migrations:"
  pg "psql -U \"\$POSTGRES_USER\" -d $scratch -c 'select id, hash, created_at from drizzle.__drizzle_migrations order by created_at'"
  log "Key tables:"
  pg "psql -U \"\$POSTGRES_USER\" -d $scratch -c 'select (select count(*) from users) as users, (select count(*) from admin_users) as admins, (select count(*) from rag_knowledge_bases) as knowledge_bases, (select count(*) from rag_documents) as documents, (select count(*) from rag_chunks) as chunks'"
  if [[ -d "$backup/storage" ]]; then
    log "Storage objects in backup: $(find "$backup/storage" -type f | wc -l | tr -d ' ')"
  fi
  log "Verify OK: the dump restores cleanly. The scratch database is dropped on exit."
  exit 0
fi

[[ -z "$mode" ]] || { echo "unknown option: $mode" >&2; exit 1; }
cat "$backup/manifest.txt" 2>/dev/null || true
what="the live database"
[[ -d "$backup/storage" ]] && what="$what and storage objects"
read -r -p "Replace $what with $backup? Type 'restore' to continue: " answer
[[ "$answer" == "restore" ]] || { echo "aborted"; exit 1; }

log "Stopping api"
docker compose stop api

log "Recreating the database from postgres.dump"
pg 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
pg 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$backup/postgres.dump"

if [[ -d "$backup/storage" ]]; then
  bucket="$(env_value STORAGE_BUCKET app)"
  log "Restoring objects into s3://$bucket (objects added after the backup are kept)"
  aws_cli "$backup" s3 sync --only-show-errors /backup/storage "s3://$bucket"
fi

# Cached permissions, queued jobs and session revocation markers refer to the replaced data.
log "Flushing Redis"
docker compose exec -T redis redis-cli FLUSHALL > /dev/null

log "Starting api"
docker compose up -d --wait api
log "Restore complete. Documents that were pending/processing at backup time must be re-ingested."
