# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

仓库级的命令、工作区边界和运行时注意事项统一维护在 `AGENTS.md`，这里直接导入，避免两份文档不同步：

@AGENTS.md

## 补充说明

- 本仓库是 pnpm workspace + Turborepo 多应用模板：`apps/admin`（Vue 3 管理端）、`apps/client`（Vue 3 展示端）、`apps/server`（NestJS/Fastify API）、`apps/docs`（Next.js 文档站）。四个应用彼此独立，前后端尚未打通（URL 前缀、端口、CORS、跨域 Cookie 都需要联调时再处理），不要假设管理端的示例 API 在后端已实现。
- 修改 `apps/admin` 或 `apps/server` 前，先阅读对应目录下的 `AGENTS.md`。管理端更深入的架构与测试策略见 `apps/admin/.agents/skills/shadcn-vue-admin/references/SYSTEM_KNOWLEDGE_MAP.md` 和 `testing-strategy.md`。
- 管理端改动 `src/lib/**`、`src/utils/**`、`src/composables/**`、`src/services/**`、`src/router/**`、`src/stores/**` 等核心逻辑时，必须在同一改动中补充/调整测试并运行。
- 各应用 lint 工具不同：admin 用 Antfu ESLint（`lint:fix`），server 用 `oxlint --type-aware`，docs/ui 用共享的 `@repo/eslint-config`（docs 为 `--max-warnings 0`）；client 没有 lint，`build` 中的 `vue-tsc` 即其类型检查。
- admin 的 ESLint 配置设置了 `pnpm: { catalogs: false }`：否则根 `catalog:` 存在时，Antfu 的 `pnpm/json-enforce-catalog` 会要求所有依赖进 catalog，且即使不加 `--fix` 也会改写根 `pnpm-workspace.yaml`。新增共享版本时手动写入 catalog。
- 修改 `turbo.json` 或 Turbo 相关命令前，按 `AGENTS.md` 末尾的说明先阅读已安装 `turbo` 包内的 `docs/`。
