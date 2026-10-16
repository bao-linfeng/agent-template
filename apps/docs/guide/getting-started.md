# 快速开始

## 环境要求

- Node.js **24.22 或更高版本**（Windows 上 24.15 等较早的 24.x 跑全量 server e2e 时，Vitest 子进程会随机原生崩溃，退出码 0xC0000409，表现为 "Worker exited unexpectedly"）。
- pnpm **11.25.0**，由根 `package.json` 的 `packageManager` 固定。
- 所有工作区共用根 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`，依赖统一在仓库根目录安装。

```sh
pnpm install --frozen-lockfile
```

新增或修改依赖后运行 `pnpm install` 更新根锁文件。工作区对新发布的依赖设置了 24 小时等待期（`minimumReleaseAge`）。

## 本地开发

启动全部应用：

```sh
pnpm dev
```

单独启动：

```sh
pnpm -C apps/admin dev   # 管理端
pnpm -C apps/client dev  # 展示端，端口 5174
pnpm -C apps/server dev  # 后端，端口 3100
pnpm -C apps/docs dev    # 文档站，端口 3001
```

Vite 与 VitePress 都使用固定端口（`strictPort`），端口被占用时直接报错，不会自动换端口。管理端端口以 `apps/admin/vite.config.ts` 中的 `server.port` 为准。

## 前后端联调

管理端（5175）和客户端（5174）已对接后端（3100，`/api` 前缀，带凭证 CORS）的账号接口：注册、登录、忘记/重置密码、个人资料与头像、修改密码；管理端另有用户、角色和 Embedding 模型管理页面。

- 管理端复制 `apps/admin/.env.example` 为 `.env` 即可使用；客户端默认请求 `http://localhost:3100/api`，可用 `VITE_API_BASE_URL` 覆盖。
- 请求都带 Cookie，遇到 401 会先刷新会话再重试一次；刷新失败时跳转登录页。
- 后端依赖本地 Docker：在 `apps/server` 复制 `.env.example` 为 `.env`，执行 `pnpm -C apps/server infra:up`、`db:migrate`、`db:seed` 后再 `dev`。
- 后端认证：Web 端使用 HttpOnly Cookie（客户端与管理端各一套），小程序/原生 App 可通过 `X-Auth-Transport: bearer` 使用客户端账号的 Bearer Token；数据保存在 PostgreSQL。
