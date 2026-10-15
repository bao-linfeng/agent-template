# Repository guidance

## Workspace boundaries

- Use Node.js >=24 and root-pinned pnpm 11.25.0. Install from the root with `pnpm install --frozen-lockfile`; dependency edits update the single root lockfile. Root workspace settings enforce a 24-hour minimum release age and explicitly allow dependency build scripts.
- Workspace globs are `apps/*` and `packages/*`. `apps/admin/shadcn-vue-admin-main/` is an upstream copy outside those globs; edit `apps/admin/src/`. Admin lint ignores the copy and Vitest only includes `src/**/*.test.ts`.
- Bun is only required by the client's optional `collect` script, not by normal install/dev/build commands.
- `apps/docs` is the Next.js/React app. `packages/ui` exports React TSX source directly (`@repo/ui/*`), has no build step, and is consumed by docs, not the Vue apps. Shared ESLint/TypeScript configs are used by docs/UI; admin, client, and server have independent toolchains.
- Read `apps/admin/AGENTS.md` or `apps/server/AGENTS.md` before changes there.

## Commands and verification

Run these from the repository root; directory targeting avoids guessing package names (`shadcn-vue-admin`, `vue-shadcn-starter`, `nest-agent`).

| Scope    | Development                         | Focused verification                                                                                                |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Admin    | `pnpm -C apps/admin dev` (5173)     | `pnpm -C apps/admin lint:fix`, `pnpm -C apps/admin build`, `pnpm -C apps/admin test`                                |
| Client   | `pnpm -C apps/client dev` (5174)    | `pnpm -C apps/client build` (includes Vue typecheck), `pnpm -C apps/client test` (no lint script)                   |
| Server   | `pnpm -C apps/server dev` (3100)    | `pnpm -C apps/server lint`, `pnpm -C apps/server build`, `pnpm -C apps/server test`, `pnpm -C apps/server test:e2e` |
| Docs     | `pnpm -C apps/docs dev` (port 3001) | `pnpm -C apps/docs lint`, `pnpm -C apps/docs check-types`, `pnpm -C apps/docs build`                                |
| React UI | —                                   | `pnpm -C packages/ui lint`, `pnpm -C packages/ui check-types`                                                       |

- Root `dev` starts all four apps; Vite ports are strict. Root `check-types` covers all apps and UI; `test` and `test:coverage` cover admin/client/server, `test:e2e` covers server. Client has no lint task. Typechecks and tests bypass Turbo cache; builds cache `.next/**` and `dist/**`.
- All tests use Vitest; `vitest`, `@vitest/coverage-v8`, `happy-dom`, and `@vue/test-utils` versions come from the root `pnpm-workspace.yaml` `catalog:` (reference them as `catalog:`). Each tested app has `test` (run once), `test:watch`, and `test:coverage`.
- Single tests: `pnpm -C apps/admin test src/utils/__tests__/env.test.ts`; `pnpm -C apps/client test src/lib/__tests__/utils.test.ts`; `pnpm -C apps/server exec vitest run src/app.controller.spec.ts`. Admin and client tests live in `src/**/__tests__/*.test.ts` and opt into DOM with `// @vitest-environment happy-dom`; client's happy-dom disables CSS file loading so tests stay offline. Server unit config matches `*.spec.ts`; e2e uses a separate config matching `*.e2e-spec.ts`.
- Admin requires `lint:fix` after code changes, build for non-trivial changes, and updated/run tests for core logic changes. Template Git hooks are not auto-installed; run checks explicitly.
- Root `format` respects `.prettierignore`, which skips admin/server and client static/base-UI templates. Use admin's Antfu `lint:fix` and server's local Prettier `format`.
- No root GitHub workflows exist; the workflows under `apps/admin/.github/` are template-local, not repository CI.

## Wiring and runtime gotchas

- Admin: `src/main.ts` registers `src/plugins/index.ts`; routing comes from `src/pages/**` plus generated layouts. Edit pages/layouts, not generated route tables. Vite generates `src/types/route-map.d.ts`, `auto-import.d.ts`, and `auto-import-components.d.ts`; do not hand-edit them.
- Admin uses Tailwind 4/Reka UI; client uses Tailwind 3/Radix Vue and explicit routes in `apps/client/src/router/index.ts`. Do not transfer styling/router conventions between them blindly.
- Admin layouts use `vite-plugin-vue-layouts-next` (Vite 8 / Router 5 support), not the older upstream plugin in the template copy. Client navigation icons are explicitly mapped in `MainNavigation.vue`; add route icons there instead of dynamically importing the entire icon library.
- Admin API transport is `src/lib/api-client.ts`; service/query functions live in `src/services/api/`. Env validation lives in `src/validators/env.validator.ts`, loaded by `src/utils/env.ts`. `.env.example` targets `http://localhost:3000/api`, but server defaults to port 3100 with no `/api` prefix or CORS setup. These templates are not pre-wired end to end.
- Server bootstrap is `src/main.ts` → `src/app.module.ts`, using Fastify and a global transforming/whitelisting validation pipe. Keep `.js` extensions on relative TypeScript imports (NodeNext ESM).
- Server auth uses an HttpOnly `access_token` cookie, not a bearer header. Users are held in memory (`src/user/user.service.ts`); there is no database/migration setup. `JWT_SECRET` is required when `NODE_ENV=production`; bootstrap has no dotenv/config loader. Nest Observe credentials in `app.module.ts` are placeholders.
- Server e2e tests create their own app through `createNestApplication()` (default Express), not the Fastify bootstrap. Passing e2e tests alone does not verify production adapter behavior.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
