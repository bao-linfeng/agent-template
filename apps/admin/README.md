# Shadcn Vue Admin

[![code style](https://antfu.me/badge-code-style.svg)](https://github.com/antfu/eslint-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Whbbit1999/shadcn-vue-admin/blob/main/LICENSE)
[![Vue 3.5+](https://img.shields.io/badge/Vue-3.5+-brightgreen.svg?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8+-4f30e8.svg?logo=vite)](https://vitejs.dev/)
[![pnpm 11+](https://img.shields.io/badge/pnpm-11.25.0-orange.svg?logo=pnpm)](https://pnpm.io/)
[![TypeScript 6.0+](https://img.shields.io/badge/TypeScript-6.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)

[简体中文](./README-CN.md) | English

基于 **shadcn-vue**、**Vue 3.5+** 和 **Vite 8** 构建的生产级管理后台 UI，聚焦响应式布局、无障碍访问和开发体验。本应用是 [agent-template](../../README.md) monorepo 的一部分，与 `apps/client` 共用 `@repo/ui` 组件库和 `@repo/utils` 工具函数。

> ⚠️ 版本说明：这是一个起步模板，将持续添加新组件和功能。

## ✨ 功能特性

- ✅ 亮色/暗色模式切换（Pinia 持久化）
- ✅ 全局搜索命令面板
- ✅ 基于文件系统的自动路由（vite-plugin-vue-layouts-next）
- ✅ shadcn-vue 可访问侧边栏导航（权限码过滤）
- ✅ 国际化（vue-i18n v11+）
- ✅ 表单验证（TanStack Vue Form + Zod 4+）
- ✅ 数据可视化（TanStack Table/Query + Unovis）
- ✅ 动画支持（AutoAnimate、Motion-V、TW Animate CSS）
- ✅ 已对接后端的完整认证与用户体系

## 📄 页面列表

| 路径                    | 说明                                             | 数据来源 |
| ----------------------- | ------------------------------------------------ | -------- |
| `/`                     | 首页（仪表板）                                   | 真实接口 |
| `/auth/login`           | 登录                                             | 真实接口 |
| `/auth/register`        | 注册（可上传头像）                               | 真实接口 |
| `/auth/forgot-password` | 忘记密码                                         | 真实接口 |
| `/auth/reset-password`  | 重置密码                                         | 真实接口 |
| `/settings/*`           | 个人资料、头像、修改密码、外观、通知、展示       | 真实接口 |
| `/users`                | 用户管理（搜索、分页、编辑、禁用、分配角色）     | 真实接口 |
| `/roles`                | 角色管理                                         | 真实接口 |
| `/ai/embedding-models`  | Embedding 模型配置（新增/编辑/测试/设默认/删除） | 真实接口 |
| `/ai-talk`              | AI 对话界面（演示）                              | 演示数据 |
| `/apps`                 | 应用列表（演示）                                 | 演示数据 |
| `/tasks`                | 任务管理（演示）                                 | 演示数据 |
| `/billing`              | 账单（演示）                                     | 演示数据 |
| `/marketing`            | 营销（演示）                                     | 演示数据 |
| `/help-center`          | 帮助中心（演示）                                 | 演示数据 |
| `/errors/404` 等        | 错误页                                           | —        |

## 🔌 后端对接

管理端通过 `src/lib/api-client.ts` 与后端通信，底层是 `@repo/utils` 的 `createApiClient`（ofetch，Cookie 认证，`credentials: 'include'`）。

- **接口基地址**：`VITE_SERVER_API_URL`（默认 `http://localhost:3100`）+ `VITE_SERVER_API_PREFIX`（默认 `/api`）
- **自动刷新**：401 时调用 `POST /api/auth/refresh` 并重试一次，并发请求共享同一次刷新；刷新失败则清空登录态并跳转登录页
- **权限过滤**：`GET /api/users/me` 返回 `roles` 和 `permissions`，用于控制侧边栏和命令面板的可见性；页面在 `<route>` 中声明 `meta.permission`
- **找回密码**：发送 `resetUrl: http://localhost:5173/auth/reset-password`，后端校验来源必须在 `APP_WEB_URL` 或 `CORS_ORIGINS` 中

已对接的 API 模块（`src/services/api/`）：

| 模块                      | 接口                                              |
| ------------------------- | ------------------------------------------------- |
| `auth.api.ts`             | 注册、登录、退出、忘记密码、重置密码              |
| `me.api.ts`               | 个人资料、头像上传/删除、修改密码、会话列表与下线 |
| `admin-users.api.ts`      | 用户列表、编辑、禁用、分配角色                    |
| `roles.api.ts`            | 角色列表、创建、编辑、删除                        |
| `embedding-models.api.ts` | Embedding 模型 CRUD 与连通性测试                  |

## 🛠️ 技术栈

| 分类          | 库与版本                                              |
| ------------- | ----------------------------------------------------- |
| 核心框架      | Vue 3.5+、TypeScript 6+                               |
| UI 组件       | `@repo/ui`（shadcn-vue）、reka-ui 2+、`@lucide/vue`   |
| 构建工具      | Vite 8+、`@vitejs/plugin-vue` 6+                      |
| 状态管理      | Pinia 4+、pinia-plugin-persistedstate 4+              |
| 路由          | Vue Router 5+、vite-plugin-vue-layouts-next 3.3+      |
| 样式          | Tailwind CSS 4+、tw-animate-css 1+                    |
| 数据请求      | TanStack Vue Query 5+、TanStack Vue Table 9+          |
| 表单验证      | TanStack Vue Form、Zod 4+                             |
| 动画          | `@formkit/auto-animate` 0.10+、motion-v 2+            |
| 国际化        | vue-i18n 11+                                          |
| HTTP 客户端   | ofetch（`@repo/utils` 的 `createApiClient`）          |
| 自动导入      | unplugin-auto-import 21+、unplugin-vue-components 32+ |
| Lint & 格式化 | ESLint 10+、`@repo/eslint-config`（Antfu）            |

## 🚀 快速开始

需要 Node.js ≥ 24，pnpm 固定为 **11.25.0**（由仓库根 `package.json` 的 `packageManager` 锁定）。

从仓库根目录安装依赖（使用共享锁文件）：

```bash
pnpm install --frozen-lockfile
```

复制环境变量文件并启动后端（参见 [apps/server/README.md](../server/README.md)），然后启动管理端：

```bash
cp .env.example .env
pnpm -C apps/admin dev   # http://localhost:5173
```

### 可用脚本

```bash
pnpm dev             # 启动开发服务器（端口 5173，固定）
pnpm build           # 类型检查（vue-tsc）+ 构建
pnpm build:analyze   # 带 Bundle 分析的构建
pnpm preview         # 预览生产构建
pnpm lint            # ESLint 检查
pnpm lint:fix        # 自动修复 lint 问题
pnpm check-types     # Vue/TypeScript 类型检查
pnpm test            # 单元测试（运行一次）
pnpm test:watch      # 单元测试（监听模式）
pnpm test:coverage   # 单元测试覆盖率报告
```

## 📁 项目结构

```
src/
├── assets/          # 全局样式、主题 CSS
├── components/      # 共享 UI 组件
├── composables/     # use-auth, use-sidebar-navigation, use-system-theme 等
├── config/          # 应用配置
├── constants/       # 常量
├── layouts/         # 页面布局（default, auth 等）
├── lib/
│   └── api-client.ts  # 统一 HTTP 客户端（Cookie + 自动刷新）
├── pages/           # 文件路由页面（见页面列表）
├── plugins/         # Vue 插件注册（src/plugins/index.ts）
├── router/          # 路由守卫、权限拦截
├── services/
│   └── api/         # 按模块拆分的 API 函数
├── stores/          # auth, theme, sidebar-config（Pinia）
├── types/           # 自动生成的路由类型（勿手动编辑）
├── utils/           # 工具函数
└── validators/      # env.validator.ts（Zod 环境变量校验）
```

> 路由声明文件（`src/types/route-map.d.ts`、`auto-import.d.ts`、`auto-import-components.d.ts`）由 Vite 自动生成，请勿手动编辑。实际开发修改 `src/`，不要编辑嵌套的 `shadcn-vue-admin-main/` 上游副本。

## 🎨 主题定制

使用 [tweakcn](https://tweakcn.com/editor/theme) 提供的预设样式，将生成的 CSS 变量复制到 `src/assets/index.css` 的 `:root`、`.dark` 和 `@theme inline` 部分即可。

## 📄 License

MIT License — 详见 [LICENSE](https://github.com/Whbbit1999/shadcn-vue-admin/blob/main/LICENSE)

## 🤝 Credits

- **Developer**: [Whbbit1999](https://github.com/Whbbit1999)
- **Original Design**: [shadcn-admin](https://github.com/satnaing/shadcn-admin)
