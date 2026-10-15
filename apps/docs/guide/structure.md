# 项目结构

| 目录                         | 用途                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `apps/admin`                 | Vue 3 管理端：文件路由、自动导入、TanStack Query/Form、Pinia |
| `apps/client`                | Vue 3 展示端：落地页区块、手写路由、运行时主题切换           |
| `apps/server`                | NestJS / Fastify API                                         |
| `apps/docs`                  | 本文档站（VitePress）                                        |
| `packages/ui`                | `@repo/ui`：shadcn-vue 组件与共享 Tailwind 主题              |
| `packages/utils`             | `@repo/utils`：框架无关的工具函数                            |
| `packages/eslint-config`     | `@repo/eslint-config`：基于 Antfu 的共享 ESLint 配置         |
| `packages/typescript-config` | `@repo/typescript-config`：共享 tsconfig                     |

## 前端技术栈

admin 与 client 使用同一套前端技术栈，共享依赖的版本由根 `pnpm-workspace.yaml` 的 `catalog:` 统一管理：

- Vue 3.5、Vue Router 5、Vite 8
- Tailwind CSS 4（`@tailwindcss/vite`）、reka-ui、`@lucide/vue`
- TypeScript 6 + vue-tsc 3、Vitest 4
- Antfu ESLint（通过 `@repo/eslint-config`）

两个应用的差异：

- **路由**：admin 由 `src/pages/**` 生成路由（`vue-router/vite`），布局来自 `vite-plugin-vue-layouts-next`；client 在 `src/router/index.ts` 中手写路由。
- **主题 token**：admin 使用 oklch 色值（`src/assets/index.css`、`themes.css`）；client 使用 hsl 色值（`src/assets/index.css`、`src/components/theming/themes.css`）。两者都通过根元素上的 `theme-*` 类和 `--radius` 切换主题，映射到 Tailwind 的部分由 `@repo/ui/styles/theme.css` 共享。
- **BuildY**：client 会把当前主题写入 `localStorage.currentState.sceleton`，供 `public/buildy` 中的页面构建器使用。这个构建器仍基于 Tailwind 3 CDN，所以 `themes.ts` 和 `themeManager.ts` 里保留了 `hsl(var(--token))` 形式的配置，不要改成 Tailwind 4 写法。
