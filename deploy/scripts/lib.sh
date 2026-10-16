# Shared helpers for the deploy scripts (sourced, not executed). Targets a Linux host with Docker Compose v2.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"

if [[ ! -f .env ]]; then
  echo "deploy/.env not found: cp .env.example .env and fill it in" >&2
  exit 1
fi

# Reads KEY from deploy/.env without sourcing it (values may contain spaces or quotes); $2 is the default.
env_value() {
  local value
  value="$(grep -E "^$1=" .env | tail -n 1 | cut -d= -f2-)" || true
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "${value:-${2:-}}"
}

log() {
  printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"
}

# Runs a shell command inside the postgres container, where POSTGRES_USER/POSTGRES_DB are set.
# POSTGRES_USER is the bootstrap superuser, which pg_restore needs to recreate the pgvector extension.
pg() {
  docker compose exec -T postgres sh -c "$1"
}

# Runs the AWS CLI (`aws <args>`) against the bundled RustFS on the compose network, with <host-dir> mounted at /backup.
aws_cli() {
  local host_dir="$1"
  shift
  # Git Bash on Windows (local drills): hand Docker a native path and disable MSYS path rewriting.
  if [[ "$(uname -s)" == MINGW* ]]; then
    host_dir="$(cd "$host_dir" && pwd -W)"
  fi
  MSYS_NO_PATHCONV=1 docker run --rm \
    --network agent-template_default \
    -v "$host_dir:/backup" \
    -e AWS_ACCESS_KEY_ID="$(env_value STORAGE_ACCESS_KEY)" \
    -e AWS_SECRET_ACCESS_KEY="$(env_value STORAGE_SECRET_KEY)" \
    -e AWS_DEFAULT_REGION="$(env_value STORAGE_REGION us-east-1)" \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    amazon/aws-cli:latest --endpoint-url http://rustfs:9000 "$@"
}
