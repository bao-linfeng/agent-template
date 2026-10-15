# Repository guidance

## Workspace boundaries

- Use Node.js >=24 and root-pinned pnpm 11.25.0. Install from the root with `pnpm install --frozen-lockfile`; dependency edits update the single root lockfile. Root workspace settings enforce a 24-hour minimum release age and explicitly allow dependency build scripts.
- Workspace globs are `apps/*` and `packages/*`. `apps/admin/shadcn-vue-admin-main/` is an upstream copy outside those globs; edit `apps/admin/src/`. Admin lint ignores the copy and Vitest only includes `src/**/*.test.ts`.
- The repository is Vue-only: there is no React/Next.js code. `apps/docs` is a VitePress site.
- Shared code lives in Just-in-Time packages that export source directly (no build step, no TypeScript `paths` used by their sources):
  - `@repo/ui` (`packages/ui`): shadcn-vue components (`@repo/ui/components/<name>`), `cn` (`@repo/ui/lib/utils`) and the shared Tailwind 4 setup (`@repo/ui/styles/theme.css`). Component sources import each other with relative paths and are excluded from ESLint to stay diffable against upstream.
  - `@repo/utils` (`packages/utils`): framework-agnostic functions (`cn`, `isExternalUrl`, `applyThemeClass`) with Vitest tests.
  - `@repo/eslint-config` (Antfu-based `defineConfig`) and `@repo/typescript-config` (`base.json`) are used by admin, client, docs and the packages. Server keeps its own oxlint/Prettier/tsconfig.
- Versions shared by more than one workspace (vue, vue-router, vite, tailwindcss, reka-ui, typescript, vue-tsc, eslint, vitest, ...) live in the root `pnpm-workspace.yaml` `catalog:`; reference them as `catalog:` and add new shared versions there by hand.
- Read `apps/admin/AGENTS.md` or `apps/server/AGENTS.md` before changes there.

## Commands and verification

Run these from the repository root; directory targeting avoids guessing package names (`shadcn-vue-admin`, `vue-shadcn-starter`, `nest-agent`, `docs`, `@repo/*`).

| Scope  | Development                         | Focused verification                                                                                                |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Admin  | `pnpm -C apps/admin dev` (5173)     | `pnpm -C apps/admin lint:fix`, `pnpm -C apps/admin build`, `pnpm -C apps/admin test`                                |
| Client | `pnpm -C apps/client dev` (5174)    | `pnpm -C apps/client lint:fix`, `pnpm -C apps/client build` (includes Vue typecheck), `pnpm -C apps/client test`    |
| Server | `pnpm -C apps/server dev` (3100)    | `pnpm -C apps/server lint`, `pnpm -C apps/server build`, `pnpm -C apps/server test`, `pnpm -C apps/server test:e2e` |
| Docs   | `pnpm -C apps/docs dev` (port 3001) | `pnpm -C apps/docs lint:fix`, `pnpm -C apps/docs check-types`, `pnpm -C apps/docs build`                            |
| UI     | —                                   | `pnpm -C packages/ui lint`, `pnpm -C packages/ui check-types`                                                       |
| Utils  | —                                   | `pnpm -C packages/utils lint:fix`, `pnpm -C packages/utils check-types`, `pnpm -C packages/utils test`              |

- Root `dev` starts all four apps; Vite/VitePress ports are strict. Root `lint` and `check-types` cover all apps and both packages; `test` and `test:coverage` cover admin/client/server/utils, `test:e2e` covers server. Typechecks and tests bypass Turbo cache; builds cache `dist/**` (docs builds into `apps/docs/dist`).
- All tests use Vitest from the root catalog. Each tested workspace has `test` (run once), `test:watch`, and `test:coverage`.
- Single tests: `pnpm -C apps/admin test src/utils/__tests__/env.test.ts`; `pnpm -C apps/client test src/composables/__tests__/useCollecty.test.ts`; `pnpm -C packages/utils test src/__tests__/theme.test.ts`; `pnpm -C apps/server exec vitest run src/app.controller.spec.ts`. Admin/client/utils tests live in `src/**/__tests__/*.test.ts` and opt into DOM with `// @vitest-environment happy-dom`; client's happy-dom disables CSS file loading so tests stay offline. Server unit config matches `*.spec.ts`; e2e uses a separate config matching `*.e2e-spec.ts`.
- Admin requires `lint:fix` after code changes, build for non-trivial changes, and updated/run tests for core logic changes. Changes to `packages/ui` or `packages/utils` affect both admin and client: verify both apps. Template Git hooks are not auto-installed; run checks explicitly.
- Root `format` respects `.prettierignore`, which skips every workspace formatted by its own tooling. Use `lint:fix` (Antfu) for admin/client/docs/packages and server's local Prettier `format`.
- No root GitHub workflows exist; the workflows under `apps/admin/.github/` are template-local, not repository CI.

## Wiring and runtime gotchas

- Admin: `src/main.ts` registers `src/plugins/index.ts`; routing comes from `src/pages/**` plus generated layouts. Edit pages/layouts, not generated route tables. Vite generates `src/types/route-map.d.ts`, `auto-import.d.ts`, and `auto-import-components.d.ts`; do not hand-edit them. Client has no auto-import, so shared components must import every Vue API explicitly.
- Admin and client share the stack (Vue 3.5, Vue Router 5, Vite 8, Tailwind 4, reka-ui, `@lucide/vue`, TS 6). Admin uses file-based routes; client uses explicit routes in `apps/client/src/router/index.ts`.
- Theming: both apps import `@repo/ui/styles/theme.css` right after `tailwindcss` and define their own tokens (admin oklch, client hsl) on `:root`, `.dark` and `.theme-*` classes. Token values must be complete colors, not Tailwind 3 HSL triplets. `theme.css` makes Tailwind scan every shared component via `@source`.
- Client BuildY: `src/components/theming/themeManager.ts` persists `localStorage.currentState.sceleton` for the Tailwind 3 CDN page builder in `public/buildy`; keep the `hsl(var(--x))` config and the HSL triplets in `themes.ts` that it emits. `public/**` is not linted.
- Admin layouts use `vite-plugin-vue-layouts-next` (Vite 8 / Router 5 support), not the older upstream plugin in the template copy. Client navigation icons are explicitly mapped in `MainNavigation.vue`; add route icons there instead of dynamically importing the entire icon library.
- New shadcn-vue components: run the CLI inside `packages/ui` (its `components.json` aliases point at `@repo/ui/*`), then rewrite generated `@repo/ui/...` imports to relative paths and add any new third-party dependency to `packages/ui/package.json`.
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
