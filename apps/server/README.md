# apps/server

NestJS 12 + Fastify 的 API 服务端底座：PostgreSQL（Drizzle ORM + pgvector）、Redis、BullMQ、RustFS（S3 兼容对象存储）、CASL 权限、Swagger、pino 日志。开发约定见 [AGENTS.md](./AGENTS.md)。

## 功能

| 模块 | 能力 |
| ---- | ---- |
| 认证 `auth` | 客户端用户与后台管理员是两套独立账号（不同的表、会话、Cookie）。客户端 `/api/auth/*`：注册即登录、登录、刷新令牌轮换（重放检测）、退出、忘记/重置密码；后台 `/api/admin/auth/*`：同样的流程但不开放注册。凭证接口独立限流 |
| 账号 `accounts` / `users` / `admins` | 个人资料、头像上传（RustFS，按文件头校验格式）、修改密码、会话列表与下线（客户端 `/api/users/me`，后台 `/api/admin/me`）；后台管理客户端用户 `/api/admin/users`（编辑、禁用）和管理员账号 `/api/admin/admins`（新建、编辑、禁用、分配角色） |
| 权限 `rbac` | 只作用于后台管理员：角色 + 权限码（`user:read`、`admin:create` 等，CASL）；系统角色 `super_admin` / `admin`。客户端用户没有角色，只能操作自己的数据 |
| AI `ai` | 后台可配置的 Embedding 模型（OpenAI 兼容接口，API Key 加密存储，连通性测试，默认模型） |
| RAG `rag` | 客户端用户自己的知识库（`/api/rag/knowledge-bases`）、文档上传（txt/md/csv/json/html）、BullMQ 后台切分与向量化、pgvector HNSW 相似度检索；后台 `/api/admin/rag/knowledge-bases` 查看/删除所有知识库 |
| 基础设施 | zod 环境变量校验、Redis 限流、邮件队列、健康检查、Swagger、请求 ID 与结构化日志 |

## 快速开始

需要 Node.js ≥ 24、pnpm 11 和 Docker。以下命令在 `apps/server` 目录执行；在仓库根目录则使用 `pnpm -C apps/server <脚本>`。

```bash
cp .env.example .env     # 本地默认值即可直接使用
pnpm infra:up            # 启动 postgres(pgvector) / redis / rustfs / mailpit
pnpm db:migrate          # 应用 drizzle/ 下的迁移
pnpm db:seed             # 系统角色、首个超级管理员（SEED_ADMIN_*）、默认 bge-m3 模型
pnpm dev                 # http://localhost:3100/api
```

- Swagger：<http://localhost:3100/api/docs>
- Mailpit 收件箱（找回密码邮件）：<http://localhost:8025>
- RustFS 控制台：<http://localhost:9001>（账号见 `.env` 中的 `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`）

本地向量化（可选）：

```bash
docker compose --profile ai up -d
docker compose exec ollama ollama pull bge-m3
```

默认模型指向 `http://localhost:11434/v1`。也可以在后台 `/api/admin/ai/embedding-models` 改成其他 OpenAI 兼容服务（vLLM、Xinference、TEI、SiliconFlow、OpenAI 等）。

## 常用脚本

| 脚本 | 说明 |
| ---- | ---- |
| `dev` / `start:debug` | 监听模式启动 |
| `build` / `start:prod` | 编译到 `dist/` 并运行 |
| `infra:up` / `infra:down` | 启停本地 Docker 依赖 |
| `db:generate` | 修改 `src/database/schema` 后生成迁移 SQL |
| `db:migrate` / `db:migrate:prod` | 开发环境（drizzle-kit）/ 生产环境（`dist/scripts/migrate.js`）应用迁移 |
| `db:seed` | 幂等初始化数据 |
| `db:studio` | Drizzle Studio |
| `lint` / `check-types` / `format` | oxlint / tsc / Prettier |
| `test` | 单元测试（离线） |
| `test:e2e` | 端到端测试，用 testcontainers 启动临时 Postgres / Redis / RustFS（需要 Docker） |

## 前端对接要点

- 所有接口都在 `/api` 前缀下，返回原始 JSON；列表接口返回 `{ items, total, page, pageSize }`。
- 跨域请求需要带上 Cookie（`credentials: 'include'`），允许的来源由 `CORS_ORIGINS` 配置（默认 5175 / 5174）。
- 客户端用户和后台管理员是两套账号：客户端调用 `/api/auth/*`、`/api/users/me` 等，Cookie 为 `access_token`/`refresh_token`；管理端调用 `/api/admin/auth/*` 和其他 `/api/admin/*`，Cookie 为 `admin_access_token`/`admin_refresh_token`。同一浏览器可同时登录两边，互不影响；同一邮箱在两边是两个无关的账号。
- 接口返回 401 时先调用对应的 `POST /api/auth/refresh`（管理端为 `/api/admin/auth/refresh`），刷新成功后重试原请求；刷新仍返回 401 时跳转登录页。
- `GET /api/admin/me` 会返回管理员的 `roles` 和 `permissions`，可用于渲染菜单和按钮权限；客户端的 `GET /api/users/me` 不含角色和权限。
- 第一个后台超级管理员由 `pnpm db:seed`（`SEED_ADMIN_*`）创建，之后的管理员在后台“Admins”页面新建。
- 找回密码时可传 `resetUrl`（例如管理端的 `http://localhost:5175/auth/reset-password`），来源必须是 `APP_WEB_URL` 或 `CORS_ORIGINS` 之一，否则返回 400；不传时链接为 `APP_WEB_URL/reset-password?token=...`。前端页面拿到 token 后调用对应的 `POST /api/auth/reset-password` 或 `POST /api/admin/auth/reset-password`。
- 修改密码时当前密码错误返回 400（不是 401），以免前端误判为登录过期。
- CORS 允许 `GET/HEAD/POST/PUT/PATCH/DELETE`；`@fastify/cors` 默认只放行前三种，新增方法时同步修改 `setup-app.ts`。
