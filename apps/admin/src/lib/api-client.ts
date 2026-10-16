/**
 * Admin instance of the shared cookie-session client from `@repo/utils` (ofetch, one shared
 * `POST /auth/refresh` + retry on 401). Paths are relative to the admin realm root
 * `<API_BASE_URL>/v1/admin`. The admin console signs in with admin accounts, which are
 * separate from client app users. When the session cannot be refreshed, it is cleared and the user is
 * sent to sign-in.
 */
import { createApiClient, getErrorMessage as getServerErrorMessage } from '@repo/utils'
import { toast } from 'vue-sonner'

import { API_BASE_URL, API_TIMEOUT } from '@/constants/app-config'
import { i18n, t } from '@/plugins/i18n'

/**
 * Localized message for a failed request: error codes with an `apiErrors.<code>` message are translated
 * (with the body's `params`), other errors show the server message, then `fallback`.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  return getServerErrorMessage(error, fallback, (code, params) => {
    const key = `apiErrors.${code}`
    return i18n.global.te(key) ? t(key, params) : undefined
  })
}

/**
 * Clear the session and send the user back to sign-in when the session cannot be refreshed.
 * Imports are lazy to avoid a cycle (router -> pages -> services -> api-client).
 */
async function handleUnauthorized() {
  const [{ default: router }, { useAuthStore }, { default: pinia }] = await Promise.all([
    import('@/router'),
    import('@/stores/auth'),
    import('@/plugins/pinia/setup'),
  ])

  const authStore = useAuthStore(pinia)
  if (!authStore.isLogin)
    return

  authStore.clear()
  toast.error(t('auth.sessionExpired'))
  const redirect = router.currentRoute.value?.fullPath
  await router.push({ path: '/auth/sign-in', query: redirect && redirect !== '/' ? { redirect } : undefined })
}

/** Versioned admin console routes of apps/server; client app routes live under `/v1/client`. */
export const ADMIN_API_ROOT = '/v1/admin'

export const { fetch: apiFetch, refreshSession } = createApiClient({
  baseURL: `${API_BASE_URL}${ADMIN_API_ROOT}`,
  timeout: API_TIMEOUT ?? 5000,
  onUnauthorized: handleUnauthorized,
})
