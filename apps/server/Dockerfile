# syntax=docker/dockerfile:1
# Production image for apps/server. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t agent-template/server .
# The same image runs the API (default CMD), migrations (node dist/scripts/migrate.js)
# and the seed (node dist/scripts/seed.js).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
# Keep in sync with the root package.json `packageManager`.
ARG PNPM_VERSION=11.25.0
ENV CI=true
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
# Download every locked package into the store once; this layer only changes with the lockfile.
# pnpm 11 also links the whole lockfile into node_modules/.pnpm, which later stages must not inherit.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN pnpm fetch --store-dir /pnpm/store && rm -rf node_modules
COPY . .

FROM base AS build
RUN pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --filter server...
RUN pnpm -C apps/server build

# Production dependencies only, in pnpm's regular layout (root node_modules/.pnpm + package symlinks).
# `pnpm deploy` is not used: without injected workspace packages it re-resolves optional
# dependencies from registry metadata, which breaks offline builds.
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile --offline --store-dir /pnpm/store --filter server

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3100
WORKDIR /app/apps/server
# Files stay root-owned (read-only for the app); the process runs as the unprivileged `node` user.
COPY --from=prod-deps /repo/node_modules /app/node_modules
COPY --from=prod-deps /repo/apps/server/node_modules ./node_modules
COPY apps/server/package.json ./package.json
COPY apps/server/drizzle ./drizzle
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 3100
# Prometheus metrics (METRICS_PORT): internal only, never publish it or route it through the gateway.
EXPOSE 9464
# Liveness only; readiness (database + Redis) is GET /<API_PREFIX>/health.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/${process.env.API_PREFIX ?? 'api'}/health/live`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# The preload starts OpenTelemetry tracing when OTEL_EXPORTER_OTLP_ENDPOINT is set (no-op otherwise).
CMD ["node", "--import", "./dist/tracing.js", "dist/main.js"]
