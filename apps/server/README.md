# apps/server

NestJS 12 + Fastify 的 API 服务端底座：PostgreSQL（Drizzle ORM + pgvector）、Redis、BullMQ、RustFS（S3 兼容对象存储）、CASL 权限、Swagger、pino 日志。开发约定见 [AGENTS.md](./AGENTS.md)。

## 功能

| 模块                                 | 能力                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 认证 `auth`                          | 客户端用户与后台管理员是两套独立账号（不同的表、会话、Cookie）。客户端 `/api/v1/client/auth/*`：邮箱验证码注册即登录、登录、刷新令牌轮换（重放检测）、退出、忘记/重置密码；后台 `/api/v1/admin/auth/*` 不开放注册。Web 使用 Cookie，客户端另支持 Bearer；凭证接口独立限流 |
| 账号 `accounts` / `users` / `admins` | 个人资料、头像上传（RustFS，按文件头校验格式）、修改密码、会话列表与下线（客户端 `/api/v1/client/users/me`，后台 `/api/v1/admin/me`）；后台管理客户端用户 `/api/v1/admin/users`（编辑、禁用）和管理员账号 `/api/v1/admin/admins`（新建、编辑、禁用、分配角色）            |
| 权限 `rbac`                          | 只作用于后台管理员：角色 + 权限码（`user:read`、`admin:create` 等，CASL）；系统角色 `super_admin` / `admin`。客户端用户没有角色，只能操作自己的数据                                                                                                                       |
| AI `ai`                              | 后台可配置的 Embedding 模型（OpenAI 兼容接口，API Key 加密存储，连通性测试，默认模型）                                                                                                                                                                                    |
| RAG `rag`                            | 客户端用户自己的知识库（`/api/v1/client/rag/knowledge-bases`）、文档上传（txt/md/csv/json/html）、BullMQ 后台切分与向量化、pgvector HNSW 相似度检索；后台 `/api/v1/admin/rag/knowledge-bases` 查看/删除所有知识库                                                         |
| 基础设施                             | zod 环境变量校验、Redis 限流、邮件队列、健康检查、Prometheus 指标（独立内部端口）、OpenTelemetry 链路追踪、Swagger、请求 ID 与结构化日志                                                                                                                                                          |

## 快速开始

需要 Node.js ≥ 24.22、根目录固定的 pnpm **11.25.0** 和 Docker。先在仓库根目录运行 `pnpm install --frozen-lockfile`，再在 `apps/server` 执行以下命令；在仓库根目录调用脚本时使用 `pnpm -C apps/server <脚本>`。

```bash
cp .env.example .env     # 本地默认值即可直接使用
pnpm infra:up            # 启动 postgres(pgvector) / redis / rustfs / mailpit，以及 COMPOSE_PROFILES 中的监控栈
pnpm db:migrate          # 应用 drizzle/ 下的迁移
pnpm db:seed             # 系统角色、首个超级管理员（SEED_ADMIN_*）、默认 bge-m3 模型
pnpm dev                 # 先 docker compose up（已运行则跳过），再监听启动 http://localhost:3100/api
```

- Swagger：<http://localhost:3100/api/docs>，JSON：<http://localhost:3100/api/docs-json>
- 就绪检查：<http://localhost:3100/api/health>（Postgres/Redis），存活检查：<http://localhost:3100/api/health/live>
- Prometheus 指标：<http://localhost:9464/metrics>（独立监听，不走 API 端口；见下文“指标”）；Grafana 仪表盘和链路查询见下文“本地监控”
- Mailpit 收件箱（注册验证码和找回密码邮件）：<http://localhost:8025>
- RustFS 控制台：<http://localhost:9001>（账号见 `.env` 中的 `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`）

Docker Compose 启动 PostgreSQL 18 + pgvector、Redis 8、RustFS 和 Mailpit；NestJS 应用在宿主机运行。首个管理员由 `SEED_ADMIN_*` 初始化，在 <http://localhost:5175/auth/sign-in> 登录；客户端用户在 <http://localhost:5174/register> 注册。

本地向量化（可选）：

```bash
docker compose --profile ai up -d
docker compose exec ollama ollama pull bge-m3
```

默认模型指向 `http://localhost:11434/v1`。也可以在后台 `/api/v1/admin/ai/embedding-models` 改成其他 OpenAI 兼容服务（vLLM、Xinference、TEI、SiliconFlow、OpenAI 等）。

## 常用脚本

| 脚本                                          | 说明                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `dev` / `start:debug`                         | 监听模式启动（`dev` 先启动 Docker 依赖并加载链路追踪预加载脚本）                |
| `build` / `start:prod`                        | 编译到 `dist/` 并运行                                                           |
| `infra:up` / `infra:down`                     | 启停本地 Docker 依赖                                                            |
| `db:generate`                                 | 修改 `src/database/schema` 后生成迁移 SQL                                       |
| `db:migrate` / `db:migrate:prod`              | 开发环境（drizzle-kit）/ 生产环境（`dist/scripts/migrate.js`）应用迁移          |
| `db:seed`                                     | 幂等初始化数据                                                                  |
| `db:studio`                                   | Drizzle Studio                                                                  |
| `lint` / `check-types` / `format`             | oxlint / tsc / Prettier                                                         |
| `test`                                        | 单元测试（离线）                                                                |
| `test:watch` / `test:coverage` / `test:debug` | Vitest 监听、覆盖率、调试                                                       |
| `test:e2e`                                    | 端到端测试，用 testcontainers 启动临时 Postgres / Redis / RustFS（需要 Docker） |

## 前端对接要点

- 默认前缀为 `/api`，可通过 `API_PREFIX` 修改。接口返回原始 JSON，分页列表返回 `{ items, total, page, pageSize }`；全局校验会拒绝未声明的 DTO 字段（400）。`/health`、`/health/live` 和 `/avatars` 是不带版本的公共路由，其余业务接口按 realm 分组。
- 跨域请求需要带上 Cookie（`credentials: 'include'`），允许的来源由 `CORS_ORIGINS` 配置（默认 5175 / 5174）。
- 客户端用户和后台管理员是两套账号：客户端调用 `/api/v1/client/auth/*`、`/api/v1/client/users/me` 等，Cookie 为 `access_token`/`refresh_token`；管理端调用 `/api/v1/admin/auth/*` 和其他 `/api/v1/admin/*`，Cookie 为 `admin_access_token`/`admin_refresh_token`。同一浏览器可同时登录两边，互不影响；同一邮箱在两边是两个无关的账号。
- 接口返回 401 时先调用对应的 `POST /api/v1/client/auth/refresh`（管理端为 `/api/v1/admin/auth/refresh`），刷新成功后重试原请求；刷新仍返回 401 时跳转登录页。
- 小程序、原生 App 等无法使用 HttpOnly Cookie 的客户端走客户端账号体系的 Bearer 模式：请求 `/api/v1/client/auth/{login,register,refresh,logout}` 时带上 `X-Auth-Transport: bearer`，登录/注册返回 `{ account, tokens }`（`tokens` 含 `accessToken`、`expiresIn`、`refreshToken`、`refreshExpiresIn`），不写 Cookie；之后的请求带 `Authorization: Bearer <accessToken>`；401 时用 `POST /api/v1/client/auth/refresh` + body `{ refreshToken }` 换取新的 `tokens`（refresh token 每次都会轮换，需覆盖保存）；退出时带上 `Authorization` 和/或 body `refreshToken`。管理端只支持 Cookie。
- `GET /api/v1/admin/me` 会返回管理员的 `roles` 和 `permissions`，可用于渲染菜单和按钮权限；客户端的 `GET /api/v1/client/users/me` 不含角色和权限。
- 第一个后台超级管理员由 `pnpm db:seed`（`SEED_ADMIN_*`）创建，之后的管理员在后台“Admins”页面新建。
- 找回密码时可传 `resetUrl`（例如管理端的 `http://localhost:5175/auth/reset-password`），来源必须是 `APP_WEB_URL` 或 `CORS_ORIGINS` 之一，否则返回 400；不传时链接为 `APP_WEB_URL/reset-password?token=...`。管理端前端使用 `/auth/reset-password`，客户端前端使用 `/reset-password`；页面拿到 token 后调用对应的 `POST /api/v1/client/auth/reset-password` 或 `POST /api/v1/admin/auth/reset-password`。
- 修改密码时当前密码错误返回 400（不是 401），以免前端误判为登录过期。
- CORS 允许 `GET/HEAD/POST/PUT/PATCH/DELETE`；`@fastify/cors` 默认只放行前三种，新增方法时同步修改 `setup-app.ts`。

## 邮箱验证码注册

1. `POST /api/v1/client/auth/register/send-code`，请求体 `{ "email": "user@example.com" }`。
2. 返回 `202 { expiresIn, resendAfter }`，从邮箱（本地 Mailpit）读取 6 位验证码。
3. `POST /api/v1/client/auth/register`，请求体包含 `email`、`password`、`nickname` 和 `code`。成功后返回账号并登录；Bearer 模式返回 `{ account, tokens }`。
4. 如需头像，登录后调用 `PUT /api/v1/client/users/me/avatar`，multipart 字段名为 `file`。

验证码默认有效期 600 秒、重发间隔 60 秒，可用 `EMAIL_CODE_TTL_SECONDS` 和 `EMAIL_CODE_RESEND_SECONDS` 调整。验证码在 Redis 中哈希存储、一次性消费，并限制错误尝试次数。已注册邮箱发码返回 409，冷却期重发返回 429，验证码错误返回 400。管理员没有发注册验证码或注册接口。

## Embedding 与 RAG

- 管理员通过 `/api/v1/admin/ai/embedding-models` 配置 OpenAI 兼容 Embedding 服务。API Key 使用 `ENCRYPTION_KEY` 加密，接口仅返回 `hasApiKey`；默认种子模型为 Ollama `bge-m3`、1024 维。
- 客户端通过 `/api/v1/client/rag/knowledge-bases` 管理自己的知识库。每个知识库绑定一个模型，上传文件或通过 `/:id/documents/text` 提交文本，再通过 `/:id/search` 检索。
- 上传目前支持 UTF-8 的 txt/md/csv/json/html；不包含 PDF/DOCX 解析。默认文档上限 20 MiB（`UPLOAD_MAX_BYTES`），头像上限 2 MiB（`AVATAR_MAX_BYTES`）。
- 头像按文件头（magic bytes）识别 PNG/JPEG/GIF/WebP，忽略客户端声明的类型；文档在上传时即做严格 UTF-8 解码。设置 `CLAMAV_HOST` 后，两类文件通过校验后还会交给 clamd 扫描再写入存储：检出病毒返回 422 `UPLOAD_INFECTED`，clamd 不可用时返回 503 `UPLOAD_SCAN_UNAVAILABLE`（fail closed）。本地用 `docker compose --profile antivirus up -d` 启动 clamd 并设置 `CLAMAV_HOST=localhost`；生产见 [deploy/README.md](../../deploy/README.md) 的「上传病毒扫描」。
- 文档经 BullMQ 在 API 进程内后台切分、批量向量化并写入 pgvector；状态为 `pending → processing → ready | failed`，可通过文档查询接口查看，或通过 `/:id/documents/:documentId/reindex` 重试。
- 模型维度最高 2000；按维度建立部分 HNSW 索引。已被知识库使用的模型不能修改 `model` 或 `dimensions`，知识库也不能切换绑定模型。
- 后台 `/api/v1/admin/rag/knowledge-bases` 可查看/删除所有用户知识库，受 `knowledge-base:read` / `knowledge-base:manage` 控制。

当前两个 Vue 应用尚无知识库页面，管理端 AI Talk 为演示界面。

## 配置与生产运行

环境变量以 `src/config/env.ts` 为准，示例见 [.env.example](./.env.example)。应用从服务端工作目录依次加载 `.env.local`、`.env`，已有进程变量优先；`NODE_ENV=test` 时跳过文件。Docker Compose 默认读取 `.env`，使用 `.env.local` 覆盖连接参数时需与基础设施保持一致。

生产环境设置 `NODE_ENV=production`、至少 32 字符的 `JWT_SECRET`、32 字节 Base64 编码的 `ENCRYPTION_KEY`，以及实际的数据库、Redis、对象存储、SMTP、`PUBLIC_URL`、`APP_WEB_URL`、`CORS_ORIGINS`。反向代理后按部署设置 `TRUST_PROXY`。生产默认关闭 Swagger、启用 Secure Cookie；链路追踪仅在配置 `OTEL_EXPORTER_OTLP_ENDPOINT` 时启用（见下文“链路追踪”）。

从仓库根目录执行：

```sh
pnpm -C apps/server build
pnpm -C apps/server db:migrate:prod
pnpm -C apps/server start:prod
```

### 指标

`METRICS_ENABLED`（默认开启）时，应用在 `METRICS_HOST:METRICS_PORT`（默认 `0.0.0.0:9464`）单独监听 `GET /metrics`，网关只转发 `PORT`，因此指标不会暴露到公网；不要发布这个端口。主要指标：

| 指标 | 说明 |
| --- | --- |
| `http_server_request_duration_seconds{method,route,status_code,realm}` | 按路由模板统计的请求耗时（不含 `/health`；未匹配路由为 `unmatched`） |
| `bullmq_queue_jobs{queue,state}` | 各队列各状态任务数，抓取时从 Redis 读取（缓存 10 秒，集群共享，用 `max by` 聚合） |
| `bullmq_jobs_processed_total{queue,name,status}` / `bullmq_jobs_failed_final_total{queue,name}` | 本实例执行的任务次数 / 重试用尽或 `UnrecoverableError` 的最终失败 |
| `bullmq_job_duration_seconds` / `bullmq_job_last_success_timestamp_seconds` | 单次执行耗时 / 每个任务名最近一次成功的时间（夜间定时任务据此告警） |
| `pg_pool_connections{state}` / `pg_pool_waiting_requests` / `pg_pool_max_connections` | PostgreSQL 连接池 |
| `upload_scans_total{result}` | 上传文件的病毒扫描结果（`clean` / `infected` / `error`，仅设置 `CLAMAV_HOST` 时） |
| `process_*` / `nodejs_*` | Node 运行时（CPU、内存、GC、事件循环延迟） |

### 链路追踪

`start:prod` 和 Docker 镜像通过 `node --import ./dist/tracing.js dist/main.js` 预加载 OpenTelemetry；设置 `OTEL_EXPORTER_OTLP_ENDPOINT`（OTLP http/protobuf，例如 Tempo 的 `http://tempo:4318`）后开始上报，未设置时不做任何事。`pnpm dev` 通过 `nest start --exec "node --import ./dist/tracing.js"` 同样加载它；`start:debug` 和测试不加载。

- 每个请求一条链路，span 名为 `<METHOD> <路由模板>`，响应头 `traceparent` 带链路 ID，可直接在 Tempo 中检索；`/health` 和 `/metrics` 不记录。
- 子 span 覆盖 PostgreSQL 查询、Redis 命令、对外 HTTP / `fetch`（对象存储、Embedding 接口）；BullMQ 任务延续入队请求的链路（`add mail.send` → `process mail`）。
- 日志行带 `trace_id` / `span_id`，可按链路 ID 搜索日志。
- `OTEL_TRACES_SAMPLER_ARG`（0–1，默认 1）控制新链路的采样比例；`OTEL_SERVICE_NAME`、`OTEL_EXPORTER_OTLP_HEADERS`、`OTEL_RESOURCE_ATTRIBUTES` 等标准变量同样生效，`OTEL_SDK_DISABLED=true` 可临时关闭。

生产部署的监控栈（Prometheus 抓取、告警规则、Grafana 仪表盘、Tempo）见 [deploy/README.md](../../deploy/README.md) 的「监控与告警」。

### 本地监控

本地 Compose 的 `observability` profile 启动同一套监控栈，复用 `deploy/observability/` 下的告警规则、仪表盘和 Tempo 配置，用于在开发时查看指标、查链路和调试告警。`.env.example` 默认设置了 `COMPOSE_PROFILES=observability` 和 `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`，所以 `pnpm dev`（包括仓库根目录的 `pnpm dev`）会连同监控栈一起启动并上报链路；不需要时删掉这两行。手动启动：

```bash
docker compose --profile observability up -d --wait   # .env 中已设置 COMPOSE_PROFILES 时等同于 pnpm infra:up
```

| 服务         | 地址                            | 说明                                                                                            |
| ------------ | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Grafana      | <http://localhost:3300>         | 免登录（匿名管理员），首页即「API 概览」仪表盘；Explore → Tempo 查链路                          |
| Prometheus   | <http://localhost:9090>         | 通过 `host.docker.internal:9464` 抓取宿主机上运行的 API                                         |
| Alertmanager | <http://localhost:9093>         | 告警邮件发到 Mailpit（<http://localhost:8025>，收件人 `ops@localhost`）；不含企业微信/飞书/钉钉 |
| Tempo        | `http://localhost:4318`（OTLP） | 接收链路，保留 72 小时                                                                          |

- 指标：Prometheus 每 15 秒抓取一次。`METRICS_PORT` 不是 9464 时，同步修改 `deploy/observability/prometheus/prometheus.local.yml`。
- 链路：`pnpm dev` 和 `pnpm start:prod` 都会上报；请求的响应头 `traceparent` 带链路 ID，可在 Grafana 中直接查询。
- 告警：开发中经常重启 API，`ApiDown` 等告警会出现在 Mailpit，属于正常现象。
- 端口都只绑定 `127.0.0.1`；`GRAFANA_PORT`、`PROMETHEUS_PORT`、`ALERTMANAGER_PORT`、`TEMPO_OTLP_PORT` 可在 `.env` 中修改。
- 停止 `pnpm dev` 不会停止容器；用 `pnpm infra:down` 停止（未设置 `COMPOSE_PROFILES` 时改用 `docker compose --profile observability down`）。

首次部署需要种子数据时，在 `apps/server` 执行 `node dist/scripts/seed.js`。迁移文件在 `drizzle/`，数据库 schema 位于 `src/database/schema/`；修改 schema 后使用 `db:generate` 生成并提交迁移。

## 目录与验证

`src/main.ts` 经 `src/setup-app.ts` 启动 Fastify；`src/app.module.ts` 组合功能模块。`src/modules/` 按业务组织，`client/` 和 `admin/` 子目录放各账号体系的控制器，共享逻辑位于模块根。基础设施在 `src/infra/`，数据库和种子在 `src/database/`，编译后脚本入口在 `dist/scripts/`。相对 TypeScript 导入使用 `.js` 扩展名（NodeNext ESM）。

```sh
pnpm -C apps/server lint
pnpm -C apps/server check-types
pnpm -C apps/server build
pnpm -C apps/server test
pnpm -C apps/server test:e2e
```

单元测试为 `src/**/*.spec.ts`，必须可离线运行。E2E 位于 `test/**/*.e2e-spec.ts`，通过 testcontainers 启动 Postgres/Redis/RustFS，以真实 `AppModule` 和生产同款 Fastify 配置运行，邮件与 Embedding 服务使用测试替身。运行 E2E 前需启动 Docker。

```sh
pnpm -C apps/server exec vitest run src/modules/rbac/ability.spec.ts
pnpm -C apps/server test:e2e test/rag.e2e-spec.ts
```
