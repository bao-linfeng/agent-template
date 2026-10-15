/**
 * Admin instance of the shared cookie-session client from `@repo/utils` (ofetch, one shared
 * `POST /admin/auth/refresh` + retry on 401). The admin console signs in with admin accounts, which are
 * separate from client app users. When the session cannot be refreshed, it is cleared and the user is
 * sent to sign-in.
 */
import { createApiClient } from '@repo/utils'
import { toast } from 'vue-sonner'

import { API_BASE_URL, API_TIMEOUT } from '@/constants/app-config'

export { getErrorMessage } from '@repo/utils'

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
  toast.error('Your session has expired, please sign in again.')
  const redirect = router.currentRoute.value?.fullPath
  await router.push({ path: '/auth/sign-in', query: redirect && redirect !== '/' ? { redirect } : undefined })
}

export const { fetch: apiFetch, refreshSession } = createApiClient({
  baseURL: API_BASE_URL,
  authPath: '/admin/auth',
  timeout: API_TIMEOUT ?? 5000,
  onUnauthorized: handleUnauthorized,
})
