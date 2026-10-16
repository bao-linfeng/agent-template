# Agent Template 管理端

[English](./README.md) | 简体中文

[Agent Template](../../README.md) 中的 Vue 管理端，基于 [shadcn-vue-admin](https://github.com/Whbbit1999/shadcn-vue-admin) 改造，与客户端共用 `@repo/ui` 和 `@repo/utils`，通过独立的管理员账号体系对接 NestJS 服务端。

## 快速开始

使用 Node.js **24+** 和根目录固定的 **pnpm 11.25.0**。以下命令在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
cp apps/admin/.env.example apps/admin/.env
pnpm -C apps/admin dev
```

登录前按[服务端说明](../server/README.md)启动基础设施、执行迁移和种子初始化。访问 <http://localhost:5175/auth/sign-in>，使用服务端 `SEED_ADMIN_*` 配置的管理员账号。其他管理员通过 `/admins` 创建，管理端不开放注册。

开发端口固定为 **5175**，占用时直接报错。

## 已实现功能

- Cookie 登录、会话恢复、401 并发共享刷新、退出和找回密码。
- 个人资料、头像上传/删除、修改密码、会话列表与远程下线。
- 客户端用户管理、管理员管理、角色管理、基于权限的菜单与路由访问。
- Embedding 模型配置、连通性测试和默认模型选择。
- 亮暗主题、侧边栏设置和命令面板。
- 应用外壳与已接入服务端页面的中英文切换。

### 页面与数据来源

| 路径                                                                    | 用途                                | 数据来源      |
| ----------------------------------------------------------------------- | ----------------------------------- | ------------- |
| `/`                                                                     | 跳转 `/dashboard/`                  | 导航          |
| `/dashboard/`                                                           | 仪表板图表和指标                    | 演示数据      |
| `/auth/sign-in`、`/auth/sign-in-2`                                      | 两种登录布局                        | 服务端 API    |
| `/auth/forgot-password`、`/auth/reset-password`                         | 找回/重置密码                       | 服务端 API    |
| `/settings/`                                                            | 个人资料、头像                      | 服务端 API    |
| `/settings/account`                                                     | 密码与会话管理                      | 服务端 API    |
| `/users`                                                                | 搜索、分页、编辑和禁用客户端用户    | 服务端 API    |
| `/admins`                                                               | 创建/编辑管理员、修改状态与分配角色 | 服务端 API    |
| `/roles`                                                                | 角色和权限管理                      | 服务端 API    |
| `/ai/embedding-models`                                                  | 模型增删改查、测试和默认模型        | 服务端 API    |
| `/settings/appearance`、`/settings/notifications`、`/settings/display`  | 模板设置表单                        | 本地/演示行为 |
| `/ai-talk`、`/apps`、`/tasks`、`/billing`、`/marketing`、`/help-center` | 模板示例页面                        | 演示数据      |
| `/auth/otp`、`/errors/*`                                                | OTP 界面示例及错误页                | 静态展示      |

AI Talk 尚未接入聊天服务；服务端已提供 RAG API，但本应用尚无知识库页面。

## 后端对接

将 `.env.example` 复制为 `.env`。默认 `VITE_SERVER_API_URL=http://localhost:3100`，`VITE_SERVER_API_PREFIX=/api`；环境校验位于 `src/validators/env.validator.ts`。

`src/lib/api-client.ts` 创建的 `apiFetch` 基地址为 `<origin><prefix>/v1/admin`，业务模块使用 `/users`、`/me` 等相对路径。

- 管理员和客户端用户的表、会话、Cookie 独立。客户端注册不会创建管理员。
- `createApiClient` 统一携带 `credentials: 'include'`；业务请求遇到 401 时共享一次 `POST /auth/refresh`，然后重试一次。会话无法恢复时清空登录态，并将原本已登录的管理员带回 `/auth/sign-in`。
- `src/stores/auth.ts` 仅在内存中保存管理员信息，路由守卫通过 `GET /me` 恢复会话，不持久化到 localStorage。
- 默认布局页面需要登录；页面 `meta.permission` 控制访问，侧边栏和命令面板按 `GET /me` 的权限码过滤。
- 忘记密码时将当前站点的 `/auth/reset-password` 作为 `resetUrl`，后端校验来源是否在 `APP_WEB_URL` 或 `CORS_ORIGINS` 中。

| `src/services/api/` 模块  | 职责                      |
| ------------------------- | ------------------------- |
| `auth.api.ts`             | 登录、退出、忘记/重置密码 |
| `me.api.ts`               | 资料、头像、密码、会话    |
| `admin-users.api.ts`      | 客户端用户管理            |
| `admins.api.ts`           | 管理员账号与角色分配      |
| `roles.api.ts`            | 角色及权限目录            |
| `embedding-models.api.ts` | Embedding 模型管理        |

`example-*` 模块保留演示行为。

## 技术栈与目录

Vue 3.5、Vue Router 5、Vite 8、TypeScript 6、Tailwind CSS 4、Pinia、TanStack Vue Query/Table/Form、Zod、Unovis、vue-i18n。共享依赖版本以根 `pnpm-workspace.yaml` 的 catalog 为准。

```text
src/
├── assets/          # CSS 入口和主题 token
├── components/      # 应用组件，基础 UI 来自 @repo/ui
├── composables/     # 认证、导航与主题逻辑
├── constants/       # 应用配置和侧边栏数据
├── layouts/         # 布局
├── lib/             # 共享 HTTP 客户端实例
├── pages/           # 文件路由页面
├── plugins/         # 插件注册、Query、Pinia、i18n
├── router/          # 路由与访问守卫
├── services/api/    # API 函数与 query/mutation hooks
├── stores/          # 认证、主题和侧边栏状态
├── types/           # 类型及自动生成的路由声明
└── validators/     # 环境变量校验
```

Vue Router 根据 `src/pages/` 生成路由，`vite-plugin-vue-layouts-next` 提供布局。`src/types/route-map.d.ts`、`auto-import.d.ts`、`auto-import-components.d.ts` 由 Vite 生成，不手动编辑。

### 国际化与主题

- 语言文件为 `src/plugins/i18n/en.json`、`zh.json`，中文键结构必须匹配英文 schema。
- 使用 `@/plugins/i18n` 的 `setLocale()` 同步 vue-i18n、dayjs、`<html lang>` 和 `localStorage['app-locale']`，默认语言是英文。
- 组件使用 `useI18n()` 或 `$t`，非组件代码导入 `t`。导航标题存消息键，Zod 校验文案在校验时调用 `t`。
- 示例页面及外观/通知/展示设置仍有英文内容。
- `src/assets/index.css` 在 `tailwindcss` 后导入 `@repo/ui/styles/theme.css`。在 `:root`、`.dark` 和主题类中定义完整颜色值，共享 Tailwind token 映射由 `packages/ui` 提供。

## 命令与验证

均从仓库根目录执行：

```sh
pnpm -C apps/admin dev
pnpm -C apps/admin lint
pnpm -C apps/admin lint:fix
pnpm -C apps/admin check-types
pnpm -C apps/admin test
pnpm -C apps/admin test:watch
pnpm -C apps/admin test:coverage
pnpm -C apps/admin build
pnpm -C apps/admin build:analyze
pnpm -C apps/admin preview
```

`build` 先运行 Vue 类型检查，再由 Vite 构建到 `dist/`。`build:analyze` 只运行带包分析的 Vite 构建，需另跑 `check-types`。包内还保留了使用 bumpp 的 `release` 脚本。

Vitest 仅收集 `src/**/*.test.ts`，DOM 用例显式启用 happy-dom。单文件示例：

```sh
pnpm -C apps/admin test src/utils/__tests__/env.test.ts
```

代码变更后运行 `lint:fix` 和相关测试，非简单变更需构建，核心逻辑变更需配套测试。共享 UI/utils 变更要同时验证 admin 和 client。约定见 [AGENTS.md](./AGENTS.md)。Git hooks 不会自动安装；`apps/admin/.github/workflows/` 是模板局部配置，不是仓库根级 CI。

## 致谢与许可

上游管理端模板采用 MIT 许可证，见 [LICENSE](./LICENSE)。感谢 [Whbbit1999](https://github.com/Whbbit1999/shadcn-vue-admin) 与原始设计 [shadcn-admin](https://github.com/satnaing/shadcn-admin)。
