# Docs

Next.js / React workspace app. Shared React components are imported directly from `@repo/ui/*`; ESLint and TypeScript configuration come from `packages/eslint-config` and `packages/typescript-config`.

## Development

Use Node.js >=24 and the root-pinned pnpm 11.25.0. Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm -C apps/docs dev
```

Open <http://localhost:3001>. Edit `app/page.tsx` for the homepage.

## Verification and production

```sh
pnpm -C apps/docs lint
pnpm -C apps/docs check-types
pnpm -C apps/docs build
pnpm -C apps/docs start --port 3001
```

`check-types` generates Next.js route types before running TypeScript. Build output is in `.next/`. See the [root README](../../README.md) for workspace-wide commands and formatting.
