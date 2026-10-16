#!/usr/bin/env bash
# Rolls out a release on this host:
#   scripts/deploy.sh [tag]      # pull <IMAGE_REGISTRY>/{server,admin,client}:<tag> (default: IMAGE_TAG in .env)
#   scripts/deploy.sh --build    # build the images from this checkout, tagged with the current git commit
# Steps: images -> infrastructure -> pre-deploy backup -> migrations -> rollout -> readiness check.
# A failed migration stops here and leaves the running release untouched (README.md, "Rollback").
# SKIP_BACKUP=1 skips the pre-deploy backup (e.g. the very first deploy).
source "$(dirname "$0")/lib.sh"

if [[ "${1:-}" == "--build" ]]; then
  IMAGE_TAG="$(git -C .. rev-parse --short HEAD)"
  export IMAGE_TAG
  log "Building images $IMAGE_TAG"
  docker compose build api admin client
else
  IMAGE_TAG="${1:-$(env_value IMAGE_TAG latest)}"
  export IMAGE_TAG
  log "Pulling images $IMAGE_TAG"
  docker compose pull api admin client
fi

log "Starting PostgreSQL, Redis and object storage"
docker compose up -d --wait postgres redis rustfs

if [[ "${SKIP_BACKUP:-}" != "1" ]]; then
  bash scripts/backup.sh pre-deploy
fi

log "Applying database migrations"
if ! docker compose run --rm migrate; then
  log "Migration failed; the previous release keeps running. Fix the migration and deploy again."
  exit 1
fi

log "Rolling out $IMAGE_TAG"
docker compose up -d --wait --remove-orphans

log "Readiness check"
docker compose exec -T api node -e "fetch('http://127.0.0.1:3100/' + (process.env.API_PREFIX ?? 'api') + '/health').then(async (r) => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) }, () => process.exit(1))"

printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$IMAGE_TAG" >> .deploy-history
log "Deployed $IMAGE_TAG (history: deploy/.deploy-history)"
