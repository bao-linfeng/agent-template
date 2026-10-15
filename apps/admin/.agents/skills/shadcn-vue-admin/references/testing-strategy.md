# Testing Strategy

## Current State

- Vitest is configured in `vite.config.ts`; `pnpm test` runs once and `pnpm test:watch` watches.
- Tests are limited to `src/**/*.test.ts`, excluding the nested upstream template copy.
- `pnpm build` performs a Vue/TypeScript check and Vite build.

## Policy (Strong Constraints)

- If you change logic in any of the following areas:
  - `src/lib/**`, `src/utils/**`
  - `src/composables/**`
  - `src/services/**`
  - `src/router/**`
  - `src/stores/**`
  - Add or update automated tests in the same change and run the relevant tests.
- Pure UI layout/styling changes may skip tests, but must still pass `pnpm build`.

## Agent Checklist (When Changing Code)

1. Run `pnpm lint:fix`.
2. Run `pnpm build` to catch TypeScript + build-time issues.
3. Run `pnpm test` (or pass a specific `src/` test file).
4. For core logic changes, add/adjust tests (see Policy).

## What To Test

- Pure logic/utils: unit tests (fast, deterministic).
- Composables: unit tests with mocked dependencies.
- UI components/pages: component tests only for critical interactions; prefer testing behavior over implementation details.

## Recommended Tooling (Optional)

- Unit/component: Vitest + @vue/test-utils
- E2E (only if needed): Playwright
