# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

仓库级的命令、工作区边界和运行时注意事项统一维护在 `AGENTS.md`，这里直接导入，避免两份文档不同步：

@AGENTS.md

## 补充说明

- 本仓库是 pnpm workspace + Turborepo 多应用模板：`apps/admin`（Vue 3 管理端）、`apps/client`（Vue 3 展示端）、`apps/server`（NestJS/Fastify API）、`apps/docs`（VitePress 文档站），共享代码在 `packages/ui`（`@repo/ui`）与 `packages/utils`（`@repo/utils`）。本项目不使用 React 技术栈。管理端和展示端已对接后端的认证、个人资料/头像接口，管理端还对接了用户、角色、Embedding 模型管理、审计日志、系统设置和公告管理，两端都有站内通知（铃铛、通知中心、通知偏好、SSE 实时推送；见 `AGENTS.md` 的 Wiring 小节）；管理端其余示例页面（Tasks、Billing 等）仍是假数据，不要假设它们的 API 在后端已实现。后端是供后续开发直接使用的生产级底座，改动需保持 `apps/server/AGENTS.md` 中的约定。
- 修改 `apps/admin` 或 `apps/server` 前，先阅读对应目录下的 `AGENTS.md`。管理端更深入的架构与测试策略见 `apps/admin/.agents/skills/shadcn-vue-admin/references/SYSTEM_KNOWLEDGE_MAP.md` 和 `testing-strategy.md`。
- 管理端改动 `src/lib/**`、`src/utils/**`、`src/composables/**`、`src/services/**`、`src/router/**`、`src/stores/**` 等核心逻辑时，必须在同一改动中补充/调整测试并运行。
- lint 工具：admin、client、docs、`@repo/ui`、`@repo/utils` 统一使用 `@repo/eslint-config`（Antfu ESLint，`lint:fix` 同时负责格式化）；server 用 `oxlint --type-aware` 和本地 Prettier。
- 修改 `packages/ui` 或 `packages/utils` 会同时影响 admin 和 client，两边都要跑 lint、build 和 test。
- `@repo/eslint-config` 设置了 `pnpm: { catalogs: false }`：否则根 `catalog:` 存在时，Antfu 的 `pnpm/json-enforce-catalog` 会要求所有依赖进 catalog，且即使不加 `--fix` 也会改写根 `pnpm-workspace.yaml`。新增共享版本时手动写入 catalog。
- 修改 `turbo.json` 或 Turbo 相关命令前，按 `AGENTS.md` 末尾的说明先阅读已安装 `turbo` 包内的 `docs/`。
