# syntax=docker/dockerfile:1
# Production image for apps/admin (static SPA served by unprivileged nginx). Build from the repository root:
#   docker build -f apps/admin/Dockerfile --build-arg VITE_SERVER_API_URL=https://api.example.com -t agent-template/admin .
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
RUN pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --filter shadcn-vue-admin...
# API origin without the prefix, e.g. https://api.example.com (validated by src/validators/env.validator.ts).
ARG VITE_SERVER_API_URL
ARG VITE_SERVER_API_PREFIX=/api
ARG VITE_SERVER_API_TIMEOUT=5000
RUN test -n "$VITE_SERVER_API_URL" || { echo 'Build arg VITE_SERVER_API_URL is required, e.g. https://api.example.com' >&2; exit 1; }
RUN pnpm -C apps/admin build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
