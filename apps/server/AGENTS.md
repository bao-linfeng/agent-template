# Repository Guidance

- This package belongs to the root pnpm workspace. Install from the repository root and update its shared `pnpm-lock.yaml` for dependency changes; do not create a package-local lockfile.
- Use `pnpm -C apps/server dev` from the repository root for watch mode; `start:prod` runs `dist/main.js` after `build`.
- `src/main.ts` is the application entrypoint; production bootstrap uses Fastify and listens on `PORT`, defaulting to `3100`.
- With NodeNext module resolution, keep `.js` extensions on relative TypeScript imports.
- `pnpm run test` runs unit specs (`**/*.spec.ts`); `pnpm run test:e2e` runs e2e specs (`**/*.e2e-spec.ts`) with `vitest.config.e2e.ts`. Run one unit spec with `pnpm exec vitest run src/app.controller.spec.ts`.
- `pnpm run lint` checks `src/` and `test/`; `pnpm run check-types` typechecks without emitting; `pnpm run build` compiles the application.
- `src/app.module.ts` currently configures Nest Observe with placeholder credentials; do not treat them as real secrets or as production configuration.
