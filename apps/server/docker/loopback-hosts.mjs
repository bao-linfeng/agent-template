// Preload for the local container mode (Dockerfile target `local`, root docker-compose.yml).
// apps/server/.env is shared with `pnpm dev` on the host, so its dependency addresses use localhost:
// inside a container that is the container itself. Point them at the Docker host instead, where the
// shared infrastructure (PostgreSQL, Redis) and this app's Silo / Mailpit publish their ports.
// Browser-facing addresses (PUBLIC_URL, APP_WEB_URL, CORS_ORIGINS, STORAGE_PUBLIC_ENDPOINT) are left alone.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
const DOCKER_HOST = process.env.LOOPBACK_TARGET_HOST || 'host.docker.internal'

for (const key of ['DATABASE_URL', 'REDIS_URL', 'STORAGE_ENDPOINT', 'OTEL_EXPORTER_OTLP_ENDPOINT']) {
  const value = process.env[key]
  if (!value) continue
  const url = new URL(value)
  if (LOOPBACK.has(url.hostname)) {
    url.hostname = DOCKER_HOST
    // URL#href adds "/" to an empty path; keep the original form (e.g. the S3 endpoint).
    process.env[key] = value.endsWith('/') ? url.href : url.href.replace(/\/$/, '')
  }
}

for (const key of ['SMTP_HOST', 'CLAMAV_HOST']) {
  if (LOOPBACK.has(process.env[key] ?? '')) process.env[key] = DOCKER_HOST
}
