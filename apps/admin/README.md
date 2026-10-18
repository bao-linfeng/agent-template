# Agent Template Admin

[简体中文](./README-CN.md) | English

The Vue admin console in [Agent Template](../../README.md), based on [shadcn-vue-admin](https://github.com/Whbbit1999/shadcn-vue-admin). It shares `@repo/ui` components and `@repo/utils` with the client app and connects to the NestJS server using a separate admin account realm.

## Quick start

Use Node.js **24.22+** and the root-pinned **pnpm 11.25.0**. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
cp apps/admin/.env.example apps/admin/.env
pnpm -C apps/admin dev
```

Prepare the [server infrastructure, migrations and seed data](../server/README.md) before signing in. Open <http://localhost:5175/auth/sign-in> and use the account configured by the server's `SEED_ADMIN_*` variables. Additional administrators are created on `/admins`; there is no admin registration endpoint.

The development port is fixed at **5175** and fails if occupied.

## Implemented features

- Cookie authentication, session restoration, shared refresh on 401, sign-out and password recovery.
- Profile and avatar management, password changes, session listing and remote sign-out.
- Client user management, administrator management, roles and permission-based navigation/page access.
- Embedding model configuration, connectivity testing and default-model selection.
- Light/dark themes, sidebar customization and a command palette.
- English/Chinese switching for the shell and server-connected pages.

### Routes and data sources

| Route                                                                   | Purpose                                                    | Data source         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| `/`                                                                     | Redirect to `/dashboard/`                                  | Navigation          |
| `/dashboard/`                                                           | Dashboard charts and metrics                               | Demo data           |
| `/auth/sign-in`, `/auth/sign-in-2`                                      | Sign-in layouts                                            | Server API          |
| `/auth/forgot-password`, `/auth/reset-password`                         | Password recovery                                          | Server API          |
| `/settings/`                                                            | Profile and avatar                                         | Server API          |
| `/settings/account`                                                     | Password and sessions                                      | Server API          |
| `/users`                                                                | Search, paginate, edit and disable client users            | Server API          |
| `/admins`                                                               | Create/edit administrators, change status and assign roles | Server API          |
| `/roles`                                                                | Role and permission management                             | Server API          |
| `/ai/embedding-models`                                                  | Model CRUD, connection test and default selection          | Server API          |
| `/settings/appearance`, `/settings/notifications`, `/settings/display`  | Template settings forms                                    | Local/demo behavior |
| `/ai-talk`, `/apps`, `/tasks`, `/billing`, `/marketing`, `/help-center` | Template example pages                                     | Demo data           |
| `/auth/otp`, `/errors/*`                                                | OTP UI example and error pages                             | Presentation        |

AI Talk is a demo UI; there is no connected chat service. The server exposes RAG APIs, but this app has no knowledge-base page yet.

## API and authentication

Copy `.env.example` to `.env`. By default `VITE_SERVER_API_URL` is empty and the prefix is `VITE_SERVER_API_PREFIX=/api`: the app calls `/api` on its own origin and the Vite dev server proxies it to `API_PROXY_TARGET` (default `http://localhost:3100`), so cookies stay same-site on localhost, 127.0.0.1 or a LAN IP. Set an absolute `VITE_SERVER_API_URL` to call the API directly (production images require one). Validation lives in `src/validators/env.validator.ts`.

`src/lib/api-client.ts` creates `apiFetch` with a base URL of `<origin><prefix>/v1/admin`. API modules use relative paths such as `/users` and `/me`.

- Admins and client users have separate tables, sessions and cookies. Client registration does not create an admin account.
- The shared `createApiClient` sends `credentials: 'include'`. A business request returning 401 triggers one shared `POST /auth/refresh` and one retry. An unrecoverable session is cleared and an already signed-in administrator is sent to `/auth/sign-in`.
- `src/stores/auth.ts` stores the current administrator in memory. The router restores it with `GET /me`; it is not persisted to localStorage.
- Default-layout pages require sign-in. `meta.permission` gates routes; sidebar and command-palette entries use permission codes from `GET /me`.
- Password recovery sends the current origin's `/auth/reset-password` as `resetUrl`. The server checks its origin against `APP_WEB_URL` and `CORS_ORIGINS`.

| API module in `src/services/api/` | Responsibility                             |
| --------------------------------- | ------------------------------------------ |
| `auth.api.ts`                     | Login, logout, forgot/reset password       |
| `me.api.ts`                       | Profile, avatar, password and sessions     |
| `admin-users.api.ts`              | Client user administration                 |
| `admins.api.ts`                   | Administrator accounts and role assignment |
| `roles.api.ts`                    | Roles and permission catalog               |
| `embedding-models.api.ts`         | Embedding model management                 |

The `example-*` modules contain demo behavior.

## Stack and structure

Vue 3.5, Vue Router 5, Vite 8, TypeScript 6, Tailwind CSS 4, Pinia, TanStack Vue Query/Table/Form, Zod, Unovis and vue-i18n. Shared dependency versions come from the root `pnpm-workspace.yaml` catalog.

```text
src/
├── assets/          # CSS entry and theme tokens
├── components/      # Application components; base UI comes from @repo/ui
├── composables/     # Auth, navigation and theme helpers
├── constants/       # App configuration and sidebar data
├── layouts/         # Generated layout integration
├── lib/             # Shared HTTP client instance
├── pages/           # File-based routes
├── plugins/         # Plugin setup, Query, Pinia and i18n
├── router/          # Router and access guards
├── services/api/    # API functions and query/mutation hooks
├── stores/          # Auth, theme and sidebar state
├── types/           # Types including generated route declarations
└── validators/     # Environment validation
```

Vue Router generates routes from `src/pages/`; `vite-plugin-vue-layouts-next` supplies layouts. Vite also generates `src/types/route-map.d.ts`, `auto-import.d.ts` and `auto-import-components.d.ts`; edit their source inputs rather than these declarations.

### Internationalization and themes

- Messages live in `src/plugins/i18n/en.json` and `zh.json`. Chinese messages must match the English schema.
- Use `setLocale()` from `@/plugins/i18n` to update vue-i18n, dayjs, `<html lang>` and `localStorage['app-locale']` together. The default is English.
- Components use `useI18n()` or `$t`; non-component code imports `t`. Navigation titles are message keys. Zod messages resolve `t` at validation time.
- Example pages and the Appearance/Notifications/Display tabs still contain English content.
- `src/assets/index.css` imports `@repo/ui/styles/theme.css` after `tailwindcss`. Define complete color values in `:root`, `.dark` and theme classes; shared Tailwind token mapping lives in `packages/ui`.

## Commands and verification

All commands below run from the repository root:

```sh
pnpm -C apps/admin dev
pnpm -C apps/admin lint
pnpm -C apps/admin lint:fix
pnpm -C apps/admin check-types
pnpm -C apps/admin test
pnpm -C apps/admin test:watch
pnpm -C apps/admin test:coverage
pnpm -C apps/admin build
pnpm -C apps/admin build:analyze
pnpm -C apps/admin preview
```

`build` runs Vue typechecking followed by Vite and writes `dist/`. `build:analyze` runs Vite with bundle analysis; run `check-types` separately for that script. The package also retains a `release` script using bumpp.

Vitest includes only `src/**/*.test.ts`; DOM tests opt into happy-dom. For example:

```sh
pnpm -C apps/admin test src/utils/__tests__/env.test.ts
```

After code changes, run `lint:fix` and relevant tests; run `build` for non-trivial changes. Core logic changes require corresponding tests. Shared UI/utils changes need both admin and client verification. See [AGENTS.md](./AGENTS.md) for conventions. Git hooks are not installed automatically, and `apps/admin/.github/workflows/` is template-local rather than root repository CI.

## Credits and license

The upstream admin template is MIT-licensed; see [LICENSE](./LICENSE). Credits: [Whbbit1999](https://github.com/Whbbit1999/shadcn-vue-admin), with the original design from [shadcn-admin](https://github.com/satnaing/shadcn-admin).
