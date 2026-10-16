# syntax=docker/dockerfile:1
# Production image for apps/client (static SPA served by unprivileged nginx). Build from the repository root:
#   docker build -f apps/client/Dockerfile --build-arg VITE_API_BASE_URL=https://api.example.com/api -t agent-template/client .
# Vite inlines VITE_* values at build time, so an image is bound to the API URL it was built with.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
# Keep in sync with the root package.json `packageManager`.
ARG PNPM_VERSION=11.25.0
ENV CI=true
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
# pnpm 11 also links the whole lockfile into node_modules/.pnpm; only the store is kept.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN pnpm fetch --store-dir /pnpm/store && rm -rf node_modules
COPY . .
RUN pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --filter client...
# API root including the prefix, e.g. https://api.example.com/api (src/lib/api.ts falls back to localhost).
ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" || { echo 'Build arg VITE_API_BASE_URL is required, e.g. https://api.example.com/api' >&2; exit 1; }
RUN pnpm -C apps/client build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
