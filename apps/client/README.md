# Vue Shadcn UIKit Starter

基于 Vue 3 + shadcn-vue 的落地页展示端：Hero/Blog/Navbar 区块系统、运行时主题切换，以及向 BuildY 页面构建器输送区块的 Section Collector。本应用是 [agent-template](../../README.md) monorepo 的一部分，与 `apps/admin` 共用 `@repo/ui` 组件库和 `@repo/utils` 工具函数。

## ✨ 功能特性

- **落地页区块系统**：Hero、Blog、Navbar 区块，使用 CVA variants 和 `class` prop，通过 `cn` 合并样式
- **运行时主题切换**：多套调色板（`.theme-*`），主题状态持久化到 `localStorage`
- **暗色模式切换**：`DarkMode` 组件，同步系统偏好
- **Section Collector**：点击区块上的书签图标收藏到 `localStorage.uiCollection`；集合非空时导航栏出现 BuildY 按钮，打开 `public/buildy` 中的可视化页面构建器（读取集合和当前主题）
- **账号体系**：注册（可选头像）、登录、忘记密码、重置密码、个人资料与头像管理
- **自动 Token 刷新**：401 时调用 `POST /api/auth/refresh` 并重试，并发请求共享同一次刷新，刷新失败跳转登录页

## 📄 页面列表

| 路径                       | 组件                         | 说明                         |
| -------------------------- | ---------------------------- | ---------------------------- |
| `/`                        | `Home.vue`                   | 首页（展示区块）             |
| `/hero`                    | `pages/hero/`                | Hero 区块展示                |
| `/blog`                    | `pages/blog/`                | Blog 区块展示                |
| `/account/login`           | `account/Login.vue`          | 登录                         |
| `/account/register`        | `account/Register.vue`       | 注册（可选头像，注册即登录） |
| `/account/forgot-password` | `account/ForgotPassword.vue` | 忘记密码                     |
| `/account/reset-password`  | `account/ResetPassword.vue`  | 重置密码                     |
| `/account`                 | `account/Account.vue`        | 个人资料与头像管理           |

## 🔌 后端对接

通过 `src/lib/api.ts` 与后端通信，底层是 `@repo/utils` 的 `createApiClient`（ofetch，`credentials: 'include'`，Cookie 认证，401 时自动刷新并重试一次）。

- **接口基地址**：`VITE_API_BASE_URL`（默认 `http://localhost:3100/api`）
- **会话**：Pinia store `useSessionStore()`（`src/stores/session.ts`，不持久化），在路由守卫中通过 `GET /users/me` 恢复登录态；退出或会话过期时清空 Vue Query 缓存
- **服务端状态**：TanStack Vue Query，`QueryClient` 在 `src/lib/query-client.ts`；页面提交统一用 `useMutation`（`isPending`/`error`），错误在表单内展示
- **找回密码**：发送 `resetUrl: http://localhost:5174/reset-password`，后端校验来源

## 🛠️ 技术栈

- Vue 3.5、Vue Router 5、Vite 8、TypeScript 6
- Tailwind CSS 4（via `@tailwindcss/vite`）
- `@repo/ui`（shadcn-vue 组件）、reka-ui 2+、`@lucide/vue`
- Pinia（客户端状态）、TanStack Vue Query（服务端状态）
- class-variance-authority（CVA，区块 variants）
- Vitest + happy-dom、`@repo/eslint-config`（Antfu ESLint）

## 🚀 快速开始

需要 Node.js ≥ 24，pnpm 固定为 **11.25.0**（由仓库根锁定）。

```bash
# 从仓库根目录
pnpm install --frozen-lockfile
pnpm -C apps/client dev      # http://localhost:5174（端口固定）
pnpm -C apps/client lint:fix
pnpm -C apps/client test
pnpm -C apps/client build    # vue-tsc -b && vite build
```

可选：复制 `apps/client/.env.example`（如有）为 `.env` 并设置 `VITE_API_BASE_URL`。

## 📁 项目结构

```
src/
├── assets/
│   └── index.css              # Tailwind 入口 + 默认 token
├── components/
│   ├── account/               # 账号相关表单组件
│   ├── collecty/              # Section Collector 触发器与指示器
│   ├── darkMode/              # 暗色模式切换
│   ├── layers/                # @repo/ui 组件的薄封装层
│   ├── layout/                # Section / Container / Grid 布局组件
│   ├── sections/
│   │   ├── hero/              # Hero 区块
│   │   ├── blog/              # Blog 区块
│   │   └── navbar/            # Navbar 区块
│   └── theming/
│       ├── ThemingSettings.vue  # 主题设置面板
│       ├── themeManager.ts      # 持久化 + BuildY 格式输出
│       ├── themes.css           # .theme-* 调色板
│       └── themes.ts            # Tailwind 3 CDN 兼容格式（BuildY 用）
├── composables/
│   ├── useCollecty.ts         # Section Collector 逻辑
│   ├── useFlash.ts            # Flash 消息
│   ├── useFont.ts             # 字体切换
│   └── useObjectUrl.ts        # Blob/File 对象 URL 管理
├── lib/
│   ├── account.ts             # 账号相关接口
│   ├── api.ts                 # HTTP 客户端（Cookie + 自动刷新）
│   └── query-client.ts        # Vue Query 的 QueryClient
├── pages/                     # 路由页面
├── router/                    # 显式路由表（src/router/index.ts）
├── stores/
│   └── session.ts             # 登录态（Pinia）
└── types/                     # 类型定义
```

## 开发规范

- **基础 UI**：从 `@repo/ui/components/<name>` 引入组件，`cn` 从 `@repo/utils` 引入。不要将 shadcn 组件复制进本应用；需要新组件时添加到 `packages/ui`，admin 也可复用。
- **区块开发**：在 `src/components/sections/` 中使用 CVA variants 和 `class` prop 构建区块。
- **主题 Token**：`src/assets/index.css` 存放默认值，`src/components/theming/themes.css` 存放 `.theme-*` 调色板。值必须是完整的 `hsl(...)` 颜色（供 `@repo/ui/styles/theme.css` 消费）。
- **BuildY 兼容**：`themeManager.ts` 同时向 `localStorage.currentState` 写入 Tailwind 3 格式和 HSL triplet 样式（供 BuildY 的 CDN Tailwind 3 使用）；修改主题时保持该格式不变。
- **导航图标**：在 `MainNavigation.vue` 中显式映射，不要动态导入整个图标库。
- **Client 无自动导入**：所有 Vue API 必须显式 import（不同于 admin 的 unplugin-auto-import）。

## License

MIT License
