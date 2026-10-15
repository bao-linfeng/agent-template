# 快速开始

## 环境要求

- Node.js **24 或更高版本**。
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

各应用仍是独立模板，尚未打通：

- 管理端 `.env.example` 指向 `http://localhost:3000/api`，后端默认监听 `3100` 且没有全局 `/api` 前缀。
- 后端未配置 CORS，管理端 API 客户端也未配置跨域 Cookie。联调时需要同时处理 URL、跨域与 Cookie。
- 后端认证使用 HttpOnly `access_token` Cookie，用户数据保存在内存中，重启即丢失。
