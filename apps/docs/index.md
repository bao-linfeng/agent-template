---
layout: home

hero:
  name: Agent Template
  text: Vue 3 + NestJS 多应用模板
  tagline: pnpm workspace + Turborepo，管理端与展示端共用同一套 UI 组件和工具函数
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 共享包
      link: /guide/shared-packages

features:
  - title: 管理端 apps/admin
    details: Vue 3 + Vite 8 + Tailwind 4，文件路由，TanStack Query/Form，Pinia。
  - title: 展示端 apps/client
    details: Vue 3 + Vite 8 + Tailwind 4 的落地页区块集合，手写路由，运行时主题切换。
  - title: 后端 apps/server
    details: NestJS + Fastify，Drizzle + PostgreSQL/pgvector、Redis、BullMQ、RustFS，CASL 权限与 RAG 检索。
  - title: 共享包 packages/*
    details: "@repo/ui（shadcn-vue 组件）、@repo/utils（纯函数）以及共享的 ESLint、TypeScript 配置。"
---
