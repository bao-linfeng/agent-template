# Vue Shadcn UIKit Starter

基于 Vue 3 + shadcn-vue 的落地页展示端：Hero/Blog/Navbar 区块系统、运行时主题切换，以及向 BuildY 页面构建器输送区块的 Section Collector。本应用是 [agent-template](../../README.md) monorepo 的一部分，与 `apps/admin` 共用 `@repo/ui` 组件库和 `@repo/utils` 工具函数。

## ✨ 功能特性

- **落地页区块系统**：Hero、Blog、Navbar 区块，使用 CVA variants 和 `class` prop，通过 `cn` 合并样式
- **运行时主题切换**：多套调色板（`.theme-*`），主题状态持久化到 `localStorage`
- **暗色模式切换**：`DarkMode` 组件切换并保存 `localStorage.darkMode`，初次加载可使用系统偏好
- **Section Collector**：点击区块上的书签图标收藏到 `localStorage.uiCollection`；集合非空时导航栏出现 BuildY 按钮，打开 `public/buildy` 中的可视化页面构建器（读取集合和当前主题）
- **账号体系**：邮箱验证码注册（可选头像）、登录、退出、忘记/重置密码、个人资料、头像与修改密码
- **自动 Token 刷新**：业务请求遇到 401 时调用 `POST /api/v1/client/auth/refresh` 并重试一次，并发请求共享刷新；失败时清空会话，在受保护页面跳转登录页
- **中英文切换**：vue-i18n Composition API，导航栏语言切换器，保存语言偏好并同步 `<html lang>`

## 📄 页面列表

| 路径                                                                          | 组件                         | 说明                     |
| ----------------------------------------------------------------------------- | ---------------------------- | ------------------------ |
| `/`                                                                           | `Home.vue`                   | 首页（展示区块）         |
| `/hero/base`、`/hero/media`、`/hero/promo`、`/hero/split`、`/hero/split-full` | `pages/hero/`                | Hero 区块展示            |
| `/blog/base`、`/blog/lists`                                                   | `pages/blog/`                | Blog 区块展示            |
| `/login`                                                                      | `account/Login.vue`          | 登录，已登录时转到账户页 |
| `/register`                                                                   | `account/Register.vue`       | 邮箱验证码注册，可选头像 |
| `/forgot-password`                                                            | `account/ForgotPassword.vue` | 忘记密码                 |
| `/reset-password`                                                             | `account/ResetPassword.vue`  | 邮件链接中的重置页       |
| `/account`                                                                    | `account/Account.vue`        | 个人资料与头像管理       |
| `/buildy/index.html`                                                          | `public/buildy/index.html`   | 独立静态页面构建器       |

路由在 `src/router/index.ts` 显式定义；`/account` 需要登录，未匹配路径跳转首页。当前客户端未提供 RAG 知识库或 AI 聊天页面。

## 🔌 后端对接

通过 `src/lib/api.ts` 与后端通信，底层是 `@repo/utils` 的 `createApiClient`（ofetch，`credentials: 'include'`，Cookie 认证，401 时自动刷新并重试一次）。

- **接口基地址**：`VITE_API_BASE_URL`（默认 `http://localhost:3100/api`），HTTP 客户端追加 `/v1/client`；业务函数使用 `/auth/login`、`/users/me` 等相对路径
- **会话**：Pinia store `useSessionStore()`（`src/stores/session.ts`，不持久化），在路由守卫中通过 `GET /api/v1/client/users/me` 恢复登录态；退出或会话过期时清空 Vue Query 缓存
- **服务端状态**：TanStack Vue Query，`QueryClient` 在 `src/lib/query-client.ts`；页面提交统一用 `useMutation`（`isPending`/`error`），错误在表单内展示
- **找回密码**：发送 `resetUrl: http://localhost:5174/reset-password`，后端校验来源

注册先调用 `POST /auth/register/send-code`，提交 `{ email }`，返回 `202 { expiresIn, resendAfter }`；再向 `POST /auth/register` 提交 `{ email, password, nickname, code }`。本地验证码和重置邮件可在 <http://localhost:8025> 的 Mailpit 查看。默认验证码有效期 10 分钟，重发间隔 60 秒；已注册邮箱返回 409，冷却期重发返回 429。可选头像在注册登录后单独上传。

客户端用户与后台管理员是独立账号，客户端用户没有 RBAC 角色。账号功能需先按[服务端 README](../server/README.md)启动基础设施、迁移数据库并运行 API。

## 🛠️ 技术栈

- Vue 3.5、Vue Router 5、Vite 8、TypeScript 6
- Tailwind CSS 4（via `@tailwindcss/vite`）
- `@repo/ui`（shadcn-vue 组件）、reka-ui 2+、`@lucide/vue`
- Pinia（客户端状态）、TanStack Vue Query（服务端状态）
- vue-i18n 11（界面国际化）
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

可选：复制 `apps/client/.env.example` 为同目录 `.env` 并设置 `VITE_API_BASE_URL`。开发端口 5174 被占用时会直接报错。

其他脚本（从仓库根目录执行）：

```sh
pnpm -C apps/client lint
pnpm -C apps/client check-types
pnpm -C apps/client test:watch
pnpm -C apps/client test:coverage
pnpm -C apps/client build:prod
pnpm -C apps/client preview
```

`build` 和 `build:prod` 都先运行 Vue 类型检查，产物在 `dist/`；后者显式指定 production 模式。Vitest 用例在 `src/**/__tests__/*.test.ts`，DOM 用例使用 happy-dom，测试环境禁用 CSS 文件加载以保持离线。

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
├── i18n/                      # en/zh 消息、语言检测与 setLocale
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

## 国际化

入口为 `src/i18n/index.ts`，消息在 `src/i18n/locales/en.ts` 和 `zh.ts`。中文使用英文消息类型约束，缺少键会导致类型检查失败。

- 初始语言优先级：`localStorage.locale` → 浏览器语言列表 → 英文。
- 组件使用 `useI18n()`，非组件代码从 `@/i18n` 导入 `t`；切换语言使用 `setLocale()`。
- 路由 `meta.title`、`meta.description` 保存消息键，由界面翻译。
- `src/test-setup.ts` 将测试语言固定为英文。服务端错误消息按原文显示；BuildY 独立静态页不使用此 i18n 实例。

区块收藏的状态与接入方式见 [Collecty README](src/components/collecty/README.md)，页面构建器及静态区块数据约定见 [BuildY README](public/buildy/README.md)。

## License

MIT License
