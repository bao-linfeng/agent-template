# Agent Template

基于 pnpm workspace 和 Turborepo 的全栈多应用模板，包含 Vue 管理端、Vue 客户端、NestJS 后端和 VitePress 文档站点；管理端与客户端共用 `@repo/ui` 组件和 `@repo/utils` 工具函数。项目不使用 React 技术栈。

## 项目结构

| 目录                         | 用途                                                       | 开发地址                |
| ---------------------------- | ---------------------------------------------------------- | ----------------------- |
| `apps/admin`                 | Vue 3 管理端，文件路由，shadcn-vue 组件库                  | `http://localhost:5175` |
| `apps/client`                | Vue 3 展示端（落地页区块），手写路由，BuildY 页面构建器    | `http://localhost:5174` |
| `apps/server`                | NestJS 12 / Fastify API，Drizzle + PostgreSQL + pgvector   | `http://localhost:3100` |
| `apps/docs`                  | VitePress 文档站点                                         | `http://localhost:3001` |
| `packages/ui`                | `@repo/ui`：shadcn-vue 组件 + 共享 Tailwind 4 主题映射     | —                       |
| `packages/utils`             | `@repo/utils`：Cookie 会话 HTTP 客户端、错误处理与样式工具 | —                       |
| `packages/eslint-config`     | 基于 Antfu 的共享 ESLint 配置                              | —                       |
| `packages/typescript-config` | 共享 tsconfig                                              | —                       |

admin 与 client 使用同一套技术栈：Vue 3.5、Vue Router 5、Vite 8、Tailwind CSS 4、reka-ui、`@lucide/vue`、TypeScript 6。共享依赖的版本写在根 `pnpm-workspace.yaml` 的 `catalog:` 中。共享包的用法见 `apps/docs/guide/shared-packages.md`。

## 主要功能

### 管理端（apps/admin）

- 亮色/暗色模式切换（Pinia 持久化）
- 全局搜索命令面板
- Vue Router 文件路由 + vite-plugin-vue-layouts-next 布局 + 自动导入
- 中英文切换（vue-i18n），已覆盖应用外壳及已接入后端的页面；演示页仍有英文内容
- 表单验证（TanStack Vue Form + Zod 4+）
- 数据展示（TanStack Table/Query + Unovis 图表）
- 动画支持（AutoAnimate、Motion-V、TW Animate CSS）
- 客户端用户管理、独立管理员账号管理、角色权限（RBAC）、Embedding 模型配置
- 会话管理（会话列表与远程下线）

登录入口为 `/auth/sign-in`。`/` 跳转到 `/dashboard/`；仪表板、Tasks、Billing、AI Talk 等为演示页面，外观/通知/展示设置也不是后端业务配置。

### 客户端（apps/client）

- 落地页区块系统（Hero、Blog、Navbar 等，CVA variants）
- 运行时主题切换（多套调色板，持久化）
- Section Collector：收藏区块后一键进入 BuildY 可视化页面构建器
- 账号体系：邮箱验证码注册、登录、忘记/重置密码、个人资料、头像与修改密码
- 中英文切换（vue-i18n），语言选择持久化；账号入口为 `/login`、`/register`、`/account`

### 后端（apps/server）

| 模块                                 | 能力                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 认证 `auth`                          | 客户端邮箱验证码注册即登录；两套账号独立登录、刷新令牌轮换（重放检测）、退出、忘记/重置密码；Web 用 HttpOnly Cookie，客户端另支持 Bearer |
| 账号 `accounts` / `users` / `admins` | 个人资料、头像上传（RustFS）、修改密码、会话列表与下线；后台编辑/禁用客户端用户，创建/编辑/禁用管理员并分配角色                          |
| 权限 `rbac`                          | 仅用于管理员：角色 + 权限码（`user:read` 等）、CASL 规则，系统角色 `super_admin` / `admin`；客户端用户无角色                             |
| AI `ai`                              | 后台可配置的 Embedding 模型（OpenAI 兼容接口，API Key 加密存储，连通性测试，默认模型）                                                   |
| RAG `rag`                            | 客户端用户自己的知识库、文档上传（txt/md/csv/json/html）或直接提交文本、BullMQ 切分与向量化、pgvector HNSW 检索；后台查看/删除知识库     |
| 基础设施                             | zod 环境变量校验、Redis 限流、邮件队列（Mailpit）、健康检查、Swagger、请求 ID 与结构化日志                                               |

RAG 当前提供服务端 API，两个 Vue 应用尚未提供知识库页面；AI Talk 是 UI 演示，不是已接入模型的聊天功能。

## 环境与安装

- Node.js **24.22 或更高版本**（Windows 上 24.15 等较早的 24.x 跑全量 server e2e 时，Vitest 子进程会随机原生崩溃，退出码 0xC0000409，表现为 "Worker exited unexpectedly"）。
- pnpm **11.25.0**，由根 `package.json` 的 `packageManager` 固定。
- 所有应用共用根 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`；从仓库根目录安装依赖。

```sh
pnpm install --frozen-lockfile
```

新增或修改依赖后运行 `pnpm install` 更新根锁文件。工作区对新发布依赖设置了 24 小时等待期，允许执行的依赖构建脚本列在根 `pnpm-workspace.yaml`。

## 本地开发

首次启动前，先按下节准备后端环境文件、Docker 服务、数据库迁移与种子数据，再在仓库根目录启动四个应用：

```sh
pnpm dev
```

单独启动：

```sh
pnpm -C apps/admin dev
pnpm -C apps/client dev
pnpm -C apps/server dev
pnpm -C apps/docs dev
```

管理端、客户端和文档站固定使用 5175、5174、3001 端口，端口被占用时会报错，不会自动换端口。后端可通过进程环境变量 `PORT` 修改端口。

### 后端基础设施

后端依赖本地 Docker（PostgreSQL + pgvector、Redis、RustFS、Mailpit）：

```sh
cd apps/server
cp .env.example .env        # 本地默认值即可直接使用
pnpm infra:up               # 启动 postgres(pgvector) / redis / rustfs / mailpit
pnpm db:migrate             # 应用数据库迁移
pnpm db:seed                # 初始化角色、超级管理员、默认 bge-m3 模型
pnpm dev                    # http://localhost:3100/api
```

种子管理员由 `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD`、`SEED_ADMIN_NICKNAME` 配置，在管理端 `/auth/sign-in` 登录。客户端账号需在 `/register` 自行注册，并从 Mailpit 获取验证码。

本地向量化（可选，以下命令在 `apps/server` 执行）：

```sh
docker compose --profile ai up -d
docker compose exec ollama ollama pull bge-m3
```

- Swagger 文档：<http://localhost:3100/api/docs>
- Mailpit 收件箱：<http://localhost:8025>
- RustFS 控制台：<http://localhost:9001>

### 环境变量与前后端联调

管理端：复制 `apps/admin/.env.example` 为同目录 `.env`（默认 `VITE_SERVER_API_URL=http://localhost:3100`、`VITE_SERVER_API_PREFIX=/api`），校验规则位于 `src/validators/env.validator.ts`。客户端：可选 `apps/client/.env` 中的 `VITE_API_BASE_URL`，未设置时使用 `http://localhost:3100/api`。

管理端和客户端已对接后端的账号相关接口：

- 客户端用户和后台管理员是两套独立账号（不同的表、会话和 Cookie，同一邮箱在两边是两个账号）：客户端走 `/api/v1/client/auth/*`、`/api/v1/client/users/me`，管理端走 `/api/v1/admin/auth/*`、`/api/v1/admin/me`。RBAC 只用于管理员。
- 客户端先调用 `POST /api/v1/client/auth/register/send-code` 发送邮箱验证码，再携带 `code` 注册；可选头像在注册登录后上传。另有登录、退出、忘记/重置密码、个人资料与修改密码。管理端不开放注册，支持管理员/客户端用户管理、角色、Embedding 模型以及个人资料、密码和会话管理。
- 请求统一带 Cookie（`credentials: 'include'`）；业务接口返回 401 时自动调用对应的 `POST /api/v1/client/auth/refresh`（管理端 `/api/v1/admin/auth/refresh`）并重试一次，并发请求共享同一次刷新。刷新失败会清空登录态；管理端跳转登录页，客户端仅在受保护页面跳转 `/login`。登录等凭证接口的 401 不触发刷新。
- 找回密码时前端把自己的重置页地址作为 `resetUrl` 传给后端（管理端 `/auth/reset-password`，客户端 `/reset-password`），后端只接受 `APP_WEB_URL` 或 `CORS_ORIGINS` 中的来源。
- 管理端按 `GET /api/v1/admin/me` 返回的权限码过滤侧边栏和命令面板，页面可在 `<route>` 中声明 `meta.permission`；使用默认布局的页面默认需要登录。
- 生产环境必须设置 `JWT_SECRET` 和 `ENCRYPTION_KEY`；Nest Observe 仅在配置 `OBSERVE_APP_KEY`/`OBSERVE_APP_SECRET` 时启用。

## 检查与测试

根命令通过 Turbo 调度实际提供对应脚本的工作区包：

| 命令                 | 覆盖范围                                                     |
| -------------------- | ------------------------------------------------------------ |
| `pnpm lint`          | admin、client、server、docs、ui、utils                       |
| `pnpm check-types`   | admin、client、server、docs、ui、utils                       |
| `pnpm test`          | admin、client、server、utils 的单元/组件测试，运行一次后退出 |
| `pnpm test:coverage` | 同上的覆盖率报告（各自 `coverage/`）                         |
| `pnpm test:e2e`      | server 的 E2E 测试（需要 Docker）                            |
| `pnpm build`         | 四个应用；共享包直接导出源码，无独立构建                     |

管理端、客户端代码变更后先运行各自的 `lint:fix`；修改 `packages/ui` 或 `packages/utils` 时 admin 和 client 都要验证；非简单文案变更需运行 build，核心逻辑变更需更新并运行相关测试。

聚焦验证：

```sh
pnpm -C apps/admin test src/utils/__tests__/env.test.ts
pnpm -C apps/admin test:watch
pnpm -C apps/client test src/composables/__tests__/useCollecty.test.ts
pnpm -C packages/utils test
pnpm -C apps/server exec vitest run src/modules/rbac/ability.spec.ts
pnpm -C apps/server test:e2e
pnpm -C apps/client build
```

测试统一使用 Vitest，`vitest`、`@vitest/coverage-v8`、`happy-dom`、`@vue/test-utils` 的版本由根 `pnpm-workspace.yaml` 的 `catalog:` 统一管理，工作区内以 `catalog:` 引用。

后端 E2E 使用与生产相同的 Fastify 配置，并通过 testcontainers 启动临时 Postgres/Redis/RustFS，运行前需要启动 Docker。

### 格式化

- `pnpm format`：使用根 Prettier，范围由 `.prettierignore` 限定；跳过各自有格式化工具的工作区和构建产物。
- admin、client、docs、共享包：`pnpm -C <目录> lint:fix`，使用 `@repo/eslint-config`（Antfu ESLint）。
- 后端：`pnpm -C apps/server format`，使用其本地 Prettier 配置。

上游模板的自动 Git hooks 安装已移除，检查由上述命令显式执行。根级 CI 为 `.github/workflows/ci.yml`：推送 main 和 PR 时运行 lint、类型检查、测试、构建、迁移同步检查、server E2E 和三个镜像的构建；`apps/admin/.github/workflows/` 是模板附带文件，不会执行。依赖更新由 Renovate（`renovate.json`）发起，等待 1 天以配合 24 小时最小发布时间。

## 构建与运行产物

- admin / client：产物位于各自 `dist/`，可使用 `pnpm -C apps/admin preview` 或 `pnpm -C apps/client preview` 本地预览。
- server：依次执行 `pnpm -C apps/server build`、`pnpm -C apps/server db:migrate:prod`、`pnpm -C apps/server start:prod`，入口为 `dist/main.js`。
- docs：先 `pnpm -C apps/docs build`（产物在 `apps/docs/dist/`），再 `pnpm -C apps/docs preview` 本地预览。
- Turbo 缓存各工作区的 `dist/` 构建产物；类型检查和测试每次执行，不复用成功日志。

## 生产部署

server、admin、client 各有生产镜像（`apps/*/Dockerfile`，以仓库根目录为构建上下文，非 root 运行，带健康检查）。`deploy/` 提供单机 Docker Compose 部署：Caddy 自动 HTTPS、发布前备份、迁移失败不影响运行中版本、按标签回滚，以及 PostgreSQL/对象存储的备份与恢复演练脚本。推送 `v*` tag 时 `.github/workflows/release.yml` 把镜像推送到 GHCR。详见 [deploy/README.md](deploy/README.md)。

## 开发指引

开始修改前阅读根 `AGENTS.md`；管理端和后端另有各自的 `AGENTS.md`。管理端的路由和自动导入声明由 Vite 生成；后端使用 NodeNext ESM，相对 TypeScript 导入保留 `.js` 扩展名。

管理端使用 `vite-plugin-vue-layouts-next`，以匹配当前 Vite 8 和 Vue Router 5；不要从旧模板副本复制回旧布局插件依赖。

### 详细文档

- [管理端（中文）](apps/admin/README-CN.md) / [Admin (English)](apps/admin/README.md)
- [客户端](apps/client/README.md)、[服务端](apps/server/README.md)、[文档站](apps/docs/README.md)
- [共享 UI](packages/ui/README.md)、[共享工具](packages/utils/README.md)、[ESLint 配置](packages/eslint-config/README.md)
- [Collecty 区块收藏](apps/client/src/components/collecty/README.md)、[BuildY 页面构建器](apps/client/public/buildy/README.md)
