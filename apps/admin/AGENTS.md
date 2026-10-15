# AGENTS.md

## Commands

- `pnpm dev` # Start dev server
- `pnpm build` # Typecheck + build (CI-like sanity check)
- `pnpm lint:fix` # Auto-fix linting issues
- `pnpm check-types` # Vue/TypeScript check
- `pnpm test` # Run tests once; `pnpm test:watch` watches

Install dependencies at the repository root; use its pnpm version, workspace settings, and lockfile. The nested `shadcn-vue-admin-main/` is an upstream copy excluded from lint/tests, not the app to edit.

Run `pnpm lint:fix` after code changes.

Run relevant Vitest tests after code changes; one file: `pnpm test src/utils/__tests__/env.test.ts`.

## Strong Constraints (Required)

- Always run `pnpm build` for any non-trivial change (not just UI text).
- If you modify core logic (e.g. `src/lib/**`, `src/utils/**`, `src/composables/**`, `src/services/**`, `src/router/**`, `src/stores/**`):
  - Add/adjust automated tests in the same change and run them with `pnpm test`.

## Stack

- vue, shadcn-vue, tailwindcss, tanstack/vue-form, typescript, zod

## Structure

- `src/` - Vue application
- `vite.config.ts` - vite config

## Further Reading

- `.agents/skills/shadcn-vue-admin/references/SYSTEM_KNOWLEDGE_MAP.md`
- `.agents/skills/shadcn-vue-admin/references/testing-strategy.md`
