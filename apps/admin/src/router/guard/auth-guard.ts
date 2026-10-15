import type { RouteLocationNormalized, RouteMeta, Router } from 'vue-router'

import { HOME_PATH, LOGIN_PATH } from '@/constants/app'
import pinia from '@/plugins/pinia/setup'
import { useAuthStore } from '@/stores/auth'

/** Pages for signed-out users; signed-in users are sent away from them. */
const GUEST_ONLY_PATHS = new Set([LOGIN_PATH, '/auth/sign-in-2'])

/**
 * Pages rendered in the dashboard layout require a session unless they opt out with `meta.auth: false`;
 * pages with their own layout (auth, errors, marketing) are public unless they set `meta.auth: true`.
 */
export function requiresAuth(meta: RouteMeta): boolean {
  const layout = typeof meta.layout === 'object' && meta.layout !== null ? meta.layout.name : meta.layout
  return meta.auth ?? (layout === undefined || layout === 'default')
}

export function resolveAuthRedirect(
  to: Pick<RouteLocationNormalized, 'path' | 'fullPath' | 'meta'>,
  from: Pick<RouteLocationNormalized, 'path'>,
  auth: { isLogin: boolean, can: (permission: string) => boolean },
) {
  if (auth.isLogin && GUEST_ONLY_PATHS.has(to.path)) {
    // Back to the previous page when it is a real page, otherwise home.
    return from.path && from.path !== to.path && !GUEST_ONLY_PATHS.has(from.path) && from.path !== '/'
      ? from.path
      : HOME_PATH
  }

  if (!auth.isLogin && requiresAuth(to.meta)) {
    return { path: LOGIN_PATH, query: { redirect: to.fullPath } }
  }

  if (auth.isLogin && to.meta.permission && !auth.can(to.meta.permission)) {
    return { path: '/errors/403' }
  }
}

export function setupAuthGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const authStore = useAuthStore(pinia)
    if (!authStore.initialized)
      await authStore.restore()

    return resolveAuthRedirect(to, from, authStore)
  })
}
