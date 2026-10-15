/**
 * Client instance of the shared cookie-session client from `@repo/utils` (ofetch, one shared
 * `POST /auth/refresh` + retry on 401). When the session cannot be refreshed, the handlers
 * registered with `onSessionExpired` run.
 */
import { createApiClient, getErrorMessage } from '@repo/utils'
import { t } from '@/i18n'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100/api').replace(/\/+$/, '')

const sessionExpiredHandlers = new Set<() => void>()

/** Registers what happens when the session cannot be refreshed (e.g. clear state, go to login). */
export function onSessionExpired(handler: () => void): () => void {
  sessionExpiredHandlers.add(handler)
  return () => sessionExpiredHandlers.delete(handler)
}

/** Plain object bodies are sent as JSON, `FormData` as multipart; errors are ofetch `FetchError`s. */
export const { fetch: api, refreshSession } = createApiClient({
  baseURL: API_BASE_URL,
  onUnauthorized: () => {
    for (const handler of sessionExpiredHandlers)
      handler()
  },
})

/** Server messages are shown as sent; the fallback follows the UI language. */
export function errorMessage(error: unknown, fallback = t('errors.generic')): string {
  return getErrorMessage(error, fallback)
}
