#!/usr/bin/env bash
# Backs up PostgreSQL (pg_dump custom format) and, with BACKUP_STORAGE=true, the object storage bucket into
# BACKUP_DIR/<UTC timestamp>-<label>/, then prunes backups older than BACKUP_RETENTION_DAYS.
#   scripts/backup.sh [label]        # label defaults to "manual"; deploy.sh uses "pre-deploy"
# Redis is not backed up: it only holds caches, rate-limit counters, verification codes and queued jobs.
source "$(dirname "$0")/lib.sh"

label="${1:-manual}"
backup_root="$(env_value BACKUP_DIR ./backups)"
retention_days="$(env_value BACKUP_RETENTION_DAYS 14)"
target="$backup_root/$(date -u +%Y%m%dT%H%M%SZ)-$label"
mkdir -p "$target"
target="$(cd "$target" && pwd)"

log "PostgreSQL -> $target/postgres.dump"
pg 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$target/postgres.dump"
# A dump that pg_restore cannot read is not a backup.
pg 'pg_restore --list' < "$target/postgres.dump" > /dev/null

storage_files=0
if [[ "$(env_value BACKUP_STORAGE true)" == "true" ]]; then
  bucket="$(env_value STORAGE_BUCKET app)"
  # The API creates the bucket on its first start, so it is missing before the first deploy.
  if aws_cli "$target" s3api head-bucket --bucket "$bucket" > /dev/null 2>&1; then
    log "Object storage s3://$bucket -> $target/storage/"
    mkdir -p "$target/storage"
    aws_cli "$target" s3 sync --only-show-errors "s3://$bucket" /backup/storage
    storage_files="$(find "$target/storage" -type f | wc -l | tr -d ' ')"
    bucket_objects="$(aws_cli "$target" s3 ls --recursive "s3://$bucket" | wc -l | tr -d ' ')"
    if [[ "$storage_files" -lt "$bucket_objects" ]]; then
      echo "Object storage copy is incomplete: $storage_files of $bucket_objects objects" >&2
      exit 1
    fi
  else
    log "Bucket $bucket does not exist yet; skipping object storage"
  fi
fi

{
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "label=$label"
  echo "image_tag=${IMAGE_TAG:-$(env_value IMAGE_TAG latest)}"
  echo "postgres_bytes=$(wc -c < "$target/postgres.dump" | tr -d ' ')"
  echo "storage_files=$storage_files"
} > "$target/manifest.txt"

log "Pruning backups older than $retention_days days in $backup_root"
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -exec rm -rf {} +

log "Backup complete: $target"
