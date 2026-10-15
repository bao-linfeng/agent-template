/**
 * ofetch: https://github.com/unjs/ofetch
 *
 * The server authenticates with HttpOnly cookies (`access_token`, `refresh_token`), so every request
 * is sent with `credentials: 'include'`. A 401 triggers one shared `POST /auth/refresh` and a single
 * retry; if the refresh fails too, the session is cleared and the user is sent to sign-in.
 */
import type { FetchOptions } from 'ofetch'

import { FetchError, ofetch } from 'ofetch'
import { toast } from 'vue-sonner'

import { API_BASE_URL, API_TIMEOUT } from '@/constants/app-config'

/** Credential endpoints answer 401 for wrong input, not for an expired session. */
const SKIP_REFRESH = /^\/auth\/(?:login|register|refresh|logout|forgot-password|reset-password)\b/

const rawFetch = ofetch.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT ?? 5000,
  credentials: 'include',
})

let refreshing: Promise<boolean> | null = null

/** Rotates the session cookies. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= rawFetch('/auth/refresh', { method: 'post', retry: 0 })
    .then(() => true, () => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
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
  toast.error('Your session has expired, please sign in again.')
  const redirect = router.currentRoute.value?.fullPath
  await router.push({ path: '/auth/sign-in', query: redirect && redirect !== '/' ? { redirect } : undefined })
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof FetchError && error.status === 401
}

export async function apiFetch<T = any>(request: string, options?: FetchOptions<'json'>): Promise<T> {
  try {
    return await rawFetch<T>(request, options)
  }
  catch (error) {
    if (!isUnauthorized(error) || SKIP_REFRESH.test(request))
      throw error

    if (await refreshSession()) {
      try {
        return await rawFetch<T>(request, options)
      }
      catch (retryError) {
        if (isUnauthorized(retryError))
          await handleUnauthorized()
        throw retryError
      }
    }

    await handleUnauthorized()
    throw error
  }
}

/** Human readable message from a Nest error body (`message` may be a list of validation errors). */
export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof FetchError) {
    const message: unknown = error.data?.message
    if (Array.isArray(message) && message.length)
      return message.join('; ')
    if (typeof message === 'string' && message)
      return message
    return error.statusText || fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}
