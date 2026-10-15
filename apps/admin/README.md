# Shadcn Vue Admin

[![code style](https://antfu.me/badge-code-style.svg)](https://github.com/antfu/eslint-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Whbbit1999/shadcn-vue-admin/blob/main/LICENSE)
[![Vue 3.5+](https://img.shields.io/badge/Vue-3.5+-brightgreen.svg?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8+-4f30e8.svg?logo=vite)](https://vitejs.dev/)
[![pnpm 10+](https://img.shields.io/badge/pnpm-10+-orange.svg?logo=pnpm)](https://pnpm.io/)
[![TypeScript 6.0+](https://img.shields.io/badge/TypeScript-6.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)

[简体中文](./README-CN.md) | English

A production-grade admin dashboard UI built with **Shadcn-vue**, **Vue 3.5+** and **Vite**, focusing on responsiveness, accessibility and developer experience.
Forked from [shadcn-admin](https://github.com/satnaing/shadcn-admin)

![cover](.github/assets/shadcn-vue-admin.png)

> ⚠️ Version Note: This is a starter template. New components and features will be continuously added to the project.

## ✨ Key Features

- ✅ Light/Dark mode toggle with Pinia persistent state
- ✅ Global search command palette
- ✅ Accessible shadcn-ui sidebar navigation
- ✅ 20+ pre-built functional pages
- ✅ Custom component library with shadcn-vue extensions
- ✅ Auto-generated routing system (based on file structure)
- ✅ Internationalization support (vue-i18n v11+)
- ✅ Form validation with tanstack/vue-form + Zod
- ✅ Data visualization with TanStack Table/Query & Unovis
- ✅ Animation support (AutoAnimate, Motion-V, TW Animate CSS)

## 🛠️ Tech Stack & Version Constraints

| Category             | Tools & Libraries (Major Versions)                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Framework       | [Vue 3.5+](https://vuejs.org/), [TypeScript 6+](https://www.typescriptlang.org/)                                                                           |
| UI Components        | [shadcn-vue](https://www.shadcn-vue.com), [reka-ui 2+](https://www.reka-ui.com/), [@lucide/vue](https://lucide.dev/)                                       |
| Build Tool           | [Vite 8+](https://vitejs.dev/), [@vitejs/plugin-vue 6+](https://github.com/vitejs/vite-plugin-vue)                                                         |
| State Management     | [Pinia 4+](https://pinia.vuejs.org/), [pinia-plugin-persistedstate 4+](https://prazdevs.github.io/pinia-plugin-persistedstate/)                            |
| Routing              | [vue-router 5+](https://router.vuejs.org/), [vite-plugin-vue-layouts-next 3.3+](https://github.com/loicduong/vite-plugin-vue-layouts-next)                 |
| Styling              | [Tailwind CSS 4+](https://tailwindcss.com/), [tw-animate-css 1+](https://github.com/Wombosvideo/tw-animate-css)                                            |
| Data Handling        | [TanStack Vue Query 5+](https://tanstack.com/query/latest), [TanStack Vue Table 9+](https://tanstack.com/table/latest)                                     |
| Form Validation      | [TanStack Vue Form](https://tanstack.com/form/latest/docs/overview), [Zod 4+](https://zod.dev/)                                                            |
| Animation            | [@formkit/auto-animate 0.10+](https://auto-animate.formkit.com/), [motion-v 2+](https://motion-v.vercel.app/)                                              |
| Internationalization | [vue-i18n 11+](https://vue-i18n.intlify.dev/)                                                                                                              |
| HTTP Client          | [ofetch](https://github.com/unjs/ofetch)                                                                                                                   |
| Linting & Formatting | [ESLint 10+](https://eslint.org/), [@antfu/eslint-config 9+](https://github.com/antfu/eslint-config)                                                       |
| Auto Import          | [unplugin-auto-import 21+](https://github.com/antfu/unplugin-auto-import), [unplugin-vue-components 32+](https://github.com/antfu/unplugin-vue-components) |

## 🚀 Quick Start

### Prerequisites (Strict Version Requirements)

- Node.js ≥ 24 and pnpm 11.25.0 (pinned at the repository root).
- Install dependencies from the repository root using its shared lockfile.

### Installation

From the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm -C apps/admin dev
```

The dev server uses port 5173 (strict). See the [root README](../../README.md) for environment setup and backend integration limits. Edit `src/`, not the nested `shadcn-vue-admin-main/` upstream copy.

### Available Scripts

```bash
pnpm dev             # Start development server
pnpm build           # Build for production (vue-tsc + vite build)
pnpm build:analyze   # Build with bundle visualizer (ANALYZE=true)
pnpm preview         # Preview production build
pnpm lint            # ESLint check
pnpm lint:fix        # Auto fix lint issues
pnpm check-types     # Vue/TypeScript check
pnpm test            # Run unit tests once
pnpm test:watch      # Run unit tests in watch mode
pnpm test:coverage   # Run unit tests with coverage
pnpm release         # Bump version with bumpp
```

## 📖 Advanced Guides

### Dependency Maintenance

- Dependency changes update the root `pnpm-lock.yaml`; installation policy is in the root `pnpm-workspace.yaml`.
- Template Git hooks are not auto-installed. Run `pnpm lint:fix`, `pnpm build`, and relevant `pnpm test` checks explicitly from this package (or use `pnpm -C apps/admin ...` from the root).

### Theme Customization

If you need to change the website style, you can use the preset styles provided by [tweakcn](https://tweakcn.com/editor/theme). You only need to copy the css variables provided by tweakcn to `index.css` and change the `:root` `:dark` and `@theme inline` parts.

### Layout Customization (No `index.vue` in nested directories)

For pages in `pages/errors/` and `pages/auth/` that you don’t want to use the default layout:

Create a same-name file in `pages/`:
`src/pages/errors.vue`
`src/pages/auth.vue`

```vue
<template>
  <router-view />
</template>

<route lang="yml">
meta:
  layout: false
</route>
```

This will generate extra empty routes like `/errors/` and `/auth/`.
To fix it, create `index.vue` inside the directory and add redirect:

```vue
<script lang="ts" setup>
const router = useRouter()
router.replace({ name: '/errors/404' })
</script>
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](https://github.com/Whbbit1999/shadcn-vue-admin/blob/main/LICENSE) file for details.

## 🤝 Credits

- **Developer**: [Whbbit1999](https://github.com/Whbbit1999)
- **Original Design**: [shadcn-admin](https://github.com/satnaing/shadcn-admin)
