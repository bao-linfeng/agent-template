# Agent Template

基于 pnpm workspace 和 Turborepo 的多应用模板，包含 Vue 管理端、Vue 客户端、NestJS 后端和 VitePress 文档站点；管理端与客户端共用 `@repo/ui` 组件和 `@repo/utils` 工具函数。项目不使用 React 技术栈。

## 项目结构

| 目录                         | 用途                                                          | 开发地址                |
| ---------------------------- | ------------------------------------------------------------- | ----------------------- |
| `apps/admin`                 | Vue 3 管理端，文件路由                                        | `http://localhost:5173` |
| `apps/client`                | Vue 3 展示端（落地页区块），手写路由                          | `http://localhost:5174` |
| `apps/server`                | NestJS / Fastify API                                          | `http://localhost:3100` |
| `apps/docs`                  | VitePress 文档站点                                            | `http://localhost:3001` |
| `packages/ui`                | `@repo/ui`：shadcn-vue 组件 + 共享 Tailwind 4 主题映射        | —                       |
| `packages/utils`             | `@repo/utils`：框架无关的工具函数（`cn`、`isExternalUrl` 等） | —                       |
| `packages/eslint-config`     | 基于 Antfu 的共享 ESLint 配置                                 | —                       |
| `packages/typescript-config` | 共享 tsconfig                                                 | —                       |

admin 与 client 使用同一套技术栈：Vue 3.5、Vue Router 5、Vite 8、Tailwind CSS 4、reka-ui、`@lucide/vue`、TypeScript 6。共享依赖的版本写在根 `pnpm-workspace.yaml` 的 `catalog:` 中。共享包的用法见 `apps/docs/guide/shared-packages.md`。

管理端使用 `vite-plugin-vue-layouts-next`，以匹配当前 Vite 8 和 Vue Router 5；不要从旧模板副本复制回旧布局插件依赖。

`apps/admin/shadcn-vue-admin-main/` 是保留的上游模板副本，不是工作区应用；实际修改应位于 `apps/admin/src/`。它不参与管理端测试和 lint。

## 环境与安装

- Node.js **24 或更高版本**。
- pnpm **11.25.0**，由根 `package.json` 的 `packageManager` 固定。
- 所有应用共用根 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`；从仓库根目录安装依赖。

```sh
pnpm install --frozen-lockfile
```

新增或修改依赖后运行 `pnpm install` 更新根锁文件。工作区对新发布依赖设置了 24 小时等待期，允许执行的依赖构建脚本列在根 `pnpm-workspace.yaml`。

## 本地开发

启动四个应用：

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

管理端、客户端和文档站固定使用 5173、5174、3001 端口，端口被占用时会报错，不会自动换端口。后端可通过进程环境变量 `PORT` 修改端口。

### 环境变量与前后端联调

管理端：复制 `apps/admin/.env.example` 为同目录 `.env`，配置 `VITE_SERVER_API_URL`、`VITE_SERVER_API_PREFIX` 和 `VITE_SERVER_API_TIMEOUT`。校验规则位于 `src/validators/env.validator.ts`。

当前各应用仍是独立模板，尚未完成前后端联调：

- 管理端示例地址为 `http://localhost:3000/api`；后端默认监听 `3100`，没有全局 `/api` 前缀。
- 后端未配置 CORS；管理端 API 客户端也未配置跨域 Cookie 发送。联调时需同时处理 URL、跨域与 Cookie 配置。
- 后端已有注册、登录和用户资料接口，认证使用 HttpOnly `access_token` Cookie。用户数据保存在内存，重启即丢失；管理端的示例业务 API 不代表后端已实现。
- 后端直接读取进程环境变量，不自动加载 `.env`。`NODE_ENV=production` 时必须设置 `JWT_SECRET`。`src/app.module.ts` 中 Nest Observe 的凭据仍是占位符。

## 检查与测试

根命令通过 Turbo 调度实际提供对应脚本的工作区包：

| 命令                 | 覆盖范围                                                     |
| -------------------- | ------------------------------------------------------------ |
| `pnpm lint`          | admin、client、server、docs、ui、utils                       |
| `pnpm check-types`   | admin、client、server、docs、ui、utils                       |
| `pnpm test`          | admin、client、server、utils 的单元/组件测试，运行一次后退出 |
| `pnpm test:coverage` | 同上的覆盖率报告（各自 `coverage/`）                         |
| `pnpm test:e2e`      | server 的 E2E 测试                                           |
| `pnpm build`         | 四个应用；共享包直接导出源码，无独立构建                     |

管理端、客户端代码变更后先运行各自的 `lint:fix`；修改 `packages/ui` 或 `packages/utils` 时 admin 和 client 都要验证；非简单文案变更需运行 build，核心逻辑变更需更新并运行相关测试。

聚焦验证：

```sh
pnpm -C apps/admin test src/utils/__tests__/env.test.ts
pnpm -C apps/admin test:watch
pnpm -C apps/client test src/composables/__tests__/useCollecty.test.ts
pnpm -C packages/utils test
pnpm -C apps/server exec vitest run src/app.controller.spec.ts
pnpm -C apps/server test:e2e
pnpm -C apps/client build
```

测试统一使用 Vitest，`vitest`、`@vitest/coverage-v8`、`happy-dom`、`@vue/test-utils` 的版本由根 `pnpm-workspace.yaml` 的 `catalog:` 统一管理，工作区内以 `catalog:` 引用。

后端 E2E 当前通过默认 Express 适配器创建测试应用；通过这些测试并不等于验证了 Fastify 启动流程。

### 格式化

- `pnpm format`：使用根 Prettier，范围由 `.prettierignore` 限定；跳过各自有格式化工具的工作区和构建产物。
- admin、client、docs、共享包：`pnpm -C <目录> lint:fix`，使用 `@repo/eslint-config`（Antfu ESLint）。
- 后端：`pnpm -C apps/server format`，使用其本地 Prettier 配置。

上游模板的自动 Git hooks 安装已移除，检查由上述命令显式执行。`apps/admin/.github/workflows/` 是模板附带文件，不是本仓库根级 CI。

## 构建与运行产物

- admin / client：产物位于各自 `dist/`，可使用 `pnpm -C apps/admin preview` 或 `pnpm -C apps/client preview` 本地预览。
- server：先 `pnpm -C apps/server build`，再 `pnpm -C apps/server start:prod`，入口为 `dist/main.js`。
- docs：先 `pnpm -C apps/docs build`（产物在 `apps/docs/dist/`），再 `pnpm -C apps/docs preview` 本地预览。
- Turbo 缓存各工作区的 `dist/` 构建产物；类型检查和测试每次执行，不复用成功日志。

## 开发指引

开始修改前阅读根 `AGENTS.md`；管理端和后端另有各自的 `AGENTS.md`。管理端的路由和自动导入声明由 Vite 生成；后端使用 NodeNext ESM，相对 TypeScript 导入保留 `.js` 扩展名。
