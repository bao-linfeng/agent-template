import 'vue-router'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    /**
     * Whether the page needs a signed-in user. Defaults to `true` for pages in the dashboard layout
     * and `false` for pages with another layout (see `requiresAuth` in `router/guard/auth-guard.ts`).
     */
    auth?: boolean
    /** Permission code (e.g. `user:read`) required to open the page; others are sent to /errors/403. */
    permission?: string
  }
}
