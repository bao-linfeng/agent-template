# Server guidance (apps/server)

NestJS 12 + Fastify API that is meant to be built on, not a demo. Keep new code in the same shape so later agents can rely on these conventions.

## Workspace and commands

- Belongs to the root pnpm workspace: install from the repository root; dependency changes update the root `pnpm-lock.yaml` (no package-local lockfile). Run commands as `pnpm -C apps/server <script>`.
- Local infrastructure runs in Docker (`docker-compose.yml`): PostgreSQL 18 + pgvector, Redis 8, RustFS (S3) and Mailpit; `--profile ai` adds Ollama for local `bge-m3` embeddings. Compose reads `apps/server/.env`.
- First run: `cp .env.example .env` → `pnpm infra:up` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev` (port 3100). The app fails to boot when Postgres or Redis is down.
- Verify changes with `pnpm lint` (oxlint, type-aware), `pnpm check-types`, `pnpm build`, `pnpm test` (unit, `src/**/*.spec.ts`) and `pnpm test:e2e` (`test/**/*.e2e-spec.ts`, needs Docker; ~20 s container start). Format with `pnpm format` (local Prettier).
- Single unit spec: `pnpm exec vitest run src/modules/rbac/ability.spec.ts`. Single e2e file: `pnpm test:e2e test/rag.e2e-spec.ts`.
- Useful endpoints: Swagger UI `http://localhost:3100/api/docs` (JSON at `/api/docs-json`), Mailpit `http://localhost:8025`, RustFS console `http://localhost:9001`, readiness `GET /api/health`.

## Layout

```
src/
  main.ts               entry: imports config/load-env.js first, then boots Fastify via setup-app.ts
  setup-app.ts          every HTTP-level setting (cookie, helmet, multipart, CORS, /api prefix, ValidationPipe, Swagger) — shared with e2e
  app.module.ts         module wiring + global guards: ThrottlerGuard → JwtAuthGuard → PoliciesGuard
  config/               load-env.ts (.env.local, .env; skipped when NODE_ENV=test) and env.ts (zod schema = single source of env truth)
  database/             Drizzle schema (schema/*.ts), DatabaseModule (DRIZZLE / PG_POOL), migrations runner, seed, pg error helpers
  infra/                redis, storage (S3/RustFS), queue (BullMQ root + QUEUES names), mail (queue + processor + templates)
  common/               crypto (SecretBox, tokens), http (request types, multipart), dto (pagination), throttling
  modules/
    auth/               realms (user/admin), /auth + /admin/auth (login/refresh/logout/forgot/reset; register is client-only), sessions, cookies, JwtAuthGuard, @Public/@AdminController/@CurrentUser/@AuthThrottle
    accounts/           AccountsService (realm-aware profile/avatar/password/listing), AccountMeController base, /avatars (public images)
    users/              client users: /users/me, /admin/users (administration of client users)
    admins/             admin console accounts: /admin/me (profile + roles/permissions), /admin/admins (create, roles, status)
    rbac/               permission catalog, CASL ability, PoliciesGuard, @RequirePermissions/@CheckPolicies/@CurrentAbility, /admin/roles
    ai/                 embedding model registry (/admin/ai/embedding-models) + OpenAI-compatible EmbeddingClient
    rag/                knowledge bases, documents, ingest worker, RetrievalService, /rag/knowledge-bases (own) + /admin/rag/knowledge-bases (all)
    health/             /health (db + redis), /health/live
  scripts/              migrate.ts, seed.ts (compiled to dist/scripts)
drizzle/                generated SQL migrations + meta (commit them)
test/                   e2e specs, setup (testcontainers global setup), support (test app, fake embeddings)
```

## Conventions

- NodeNext ESM: keep `.js` extensions on relative imports. Inject the DB with `@InjectDb() db: Database`, Redis with `@InjectRedis()`, config with `ConfigService<Env, true>` and `config.get('KEY', { infer: true })`. Never read `process.env` outside `config/` (exception: `observe.ts` and `createFastifyAdapter`, which run before Nest config).
- New env var: add it to `config/env.ts` (with a default or a production rule) and to `.env.example`.
- Responses are plain JSON (no envelope); lists return `{ items, total, page, pageSize }` via `PaginationQueryDto`/`Paginated`. Errors are Nest `HttpException`s. The global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted` + `transform`: unknown body fields are a 400.
- DTOs: class-validator decorators in `dto/*.dto.ts`; the Swagger CLI plugin (`nest-cli.json`) derives OpenAPI schemas and uses JSDoc comments as descriptions, so do not add `@ApiProperty` unless the plugin cannot infer the type. Do not spread DTO instances into inserts (oxlint `no-misused-spread`); pick fields explicitly.
- Database changes: edit `src/database/schema/*.ts` → `pnpm db:generate --name <change>` → review the SQL → `pnpm db:migrate`. Hand-written SQL (extensions, partial/expression indexes, CHECKs) goes into `pnpm exec drizzle-kit generate --custom --name <change>`. Columns use `casing: 'snake_case'`; tables get `...timestamps`. Map pg errors with `isUniqueViolation` / `isForeignKeyViolation` (covers 23503 and RESTRICT's 23001).
- Background work: register a queue name in `infra/queue/queue.module.ts` `QUEUES`, `BullModule.registerQueue` in the feature module, and a `@Processor` extending `WorkerHost`. Throw `UnrecoverableError` for permanent failures. Workers run inside the API process.
- Files: use `StorageService` (`putObject`, `getObject`, `deletePrefix`, `getPresignedUrl`). Keys are server-generated (`avatars/<accountId>/<uuid>.<ext>` for both realms, `rag/<kbId>/<docId>/source.<ext>`), never raw user input. Read uploads with `readSingleFile(request, maxBytes)` (field `file`).
- Mail: add a template function to `infra/mail/mail.templates.ts`, then `MailService.send(to, template(...))`. Never send synchronously.

## Auth and permissions

- Two account realms that share nothing (`modules/auth/realms.ts`): **client users** (`users`, `auth_sessions`, `password_reset_tokens`; self-registered, no roles) and **admin console accounts** (`admin_users`, `admin_sessions`, `admin_password_reset_tokens`, `admin_user_roles`; created by administrators via `/admin/admins` or the seed, no registration). The same email may exist in both as unrelated accounts. Both table sets come from the same column factories, so realm-aware services (`SessionsService`, `AccountsService`, `AuthService`) take a `realm` argument and pick tables from `REALM_TABLES`.
- Every route requires authentication unless decorated `@Public()`. Routes of `@AdminController('<path>')` (mounted at `/admin/<path>`) only accept admin sessions; every other controller (`@Controller`) only accepts client sessions. Never put admin routes in a plain `@Controller('admin/...')`. Credential endpoints add `@AuthThrottle()` (stricter per-IP `AUTH_THROTTLE_*` limit; default limit `THROTTLE_*` applies everywhere, counters in Redis).
- Cookies (HttpOnly, per realm so both sessions coexist in one browser): client `access_token` (path `/`) + `refresh_token` (path `/api/auth`); admin `admin_access_token` (path `/api/admin`) + `admin_refresh_token` (path `/api/admin/auth`). The JWT carries `realm`, and a token presented to the other realm is rejected. Clients (`apps/admin/src/lib/api-client.ts` with `authPath: '/admin/auth'`, `apps/client/src/lib/api.ts`) call `POST <authPath>/refresh` on 401 and retry once, so only use 401 for a missing/expired session (e.g. a wrong current password is 400). `forgot-password` accepts `resetUrl` limited to `APP_WEB_URL`/`CORS_ORIGINS` origins. CORS methods are listed explicitly in `setup-app.ts` (`@fastify/cors` defaults to GET/HEAD/POST); refresh tokens rotate, and replaying a rotated token outside a 30 s grace window revokes the session. Logout, password change/reset and disabling an account revoke sessions and mark them in Redis, so access tokens die immediately.
- RBAC exists only for admin accounts. Permissions are codes `<subject>:<action>` in `modules/rbac/permissions.ts` (`PERMISSIONS`, `SYSTEM_ROLES`). Roles store code arrays; `super_admin` is forced to `all:manage` on boot. Per-admin permissions are cached in Redis — call `RbacService.invalidateAdmin(id)` after changing an admin's roles and `invalidateAll()` after changing role permissions.
- Admin routes: `@RequirePermissions('user:read')` (requires an unconditional rule, i.e. access to *all* records); `@CurrentAbility()` gives the CASL ability for record-level checks (`assertCan(ability, action, asSubject(type, row))`, conditions defined in `defineAbilityFor`). Client sessions have no ability: policies on client routes always deny.
- Client routes authorize by ownership in the service (e.g. `KnowledgeBasesService.getOwned(id, user.id)`, which answers 404 for other users' rows). `@CurrentUser()` returns `{ id, email, sessionId, realm }`.
- To protect a new admin resource: add its subject to `SUBJECTS` and codes to `PERMISSIONS`, then use the decorators above on an `@AdminController`. Grant it to system roles only if every deployment needs it.

## Embeddings and RAG

- Embedding models live in `ai_embedding_models` and are managed through `/api/admin/ai/embedding-models` (permission `embedding-model:*`). Provider type `openai_compatible` calls `POST {baseUrl}/embeddings` (OpenAI, Ollama `/v1`, vLLM, Xinference, TEI, SiliconFlow...). API keys are AES-256-GCM encrypted with `ENCRYPTION_KEY` and never returned (`hasApiKey` only). Exactly one default model (seeded: `bge-m3`, 1024 dims, Ollama URL).
- `rag_chunks.embedding` is an untyped `vector`; each row stores `dimensions` (CHECK keeps them equal) and every dimension has a partial HNSW index `rag_chunks_embedding_<n>_hnsw` on `(embedding::vector(n)) WHERE dimensions = n`. `EmbeddingModelsService.ensureVectorIndex` creates it (CONCURRENTLY) when a model with a new dimension is saved; 1024 is created by migration 0002. Queries must use the same cast and a literal dimension (see `RetrievalService`) or the index is skipped. Max 2000 dims.
- A knowledge base is bound to one embedding model forever; `model`/`dimensions` of a model in use cannot change — create a new model and re-ingest instead.
- Ingestion: upload/text → object stored → `rag-ingest` job → `parseDocument` (UTF-8 text formats only: txt, md, csv, json, html; add PDF/DOCX parsers in `document-parsers.ts`) → `splitText` (recursive, CJK aware) → embed in `batchSize` batches → chunks replaced in one transaction. Document status: `pending → processing → ready | failed`.
- Knowledge bases belong to client users (`ownerId` → `users`). Administrators list/inspect/delete every knowledge base via `/admin/rag/knowledge-bases` (`knowledge-base:read` / `knowledge-base:manage`).
- From code (agents, tools), call `RetrievalService.retrieve(kb, query, { topK, minScore })` after loading the knowledge base with `KnowledgeBasesService.getOwned(id, userId)` (or `get(id)` on admin paths).

## Tests

- Unit specs sit next to the code (`*.spec.ts`) and must stay offline; mock `fetch` with `vi.stubGlobal`.
- E2E specs boot the real `AppModule` on Fastify with `configureApp` (same as production) against testcontainers Postgres/Redis/RustFS and a fake OpenAI-compatible embeddings server (`test/support/fake-embeddings.ts`; model `fake-<n>` returns n dims, `broken` returns 500). Mail is captured by overriding `MAIL_TRANSPORT`. Use helpers in `test/support/test-app.ts` (`createTestApp`, `registerUser` for client users, `loginAdmin`/`createAdmin` for admin accounts, `waitFor`). Files run serially and each starts with a flushed Redis; the e2e super admin is `E2E_ADMIN` (send only `email`/`password` when logging in: unknown body fields are a 400).
- Core logic changes (auth, rbac, rag, storage, config) need updated unit and/or e2e tests in the same change.

## Production notes

- Required: `NODE_ENV=production`, `JWT_SECRET` (≥32 chars), `ENCRYPTION_KEY` (32 bytes base64), real `DATABASE_URL`/`REDIS_URL`/`STORAGE_*`/`SMTP_*`, `PUBLIC_URL`, `APP_WEB_URL`, `CORS_ORIGINS`; set `TRUST_PROXY=true` behind a proxy. Swagger is off and cookies are `Secure` by default in production.
- Deploy: `pnpm build` → `node dist/scripts/migrate.js` (`db:migrate:prod`) → `node dist/main.js`. Seed once with `node dist/scripts/seed.js` and `SEED_ADMIN_*` (creates the first admin console account).
- Embedding base URLs are admin-controlled outbound requests; only grant `embedding-model:manage` to trusted administrators.
- NestJS Observe is loaded only when `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` are set.
