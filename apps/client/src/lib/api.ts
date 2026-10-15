/**
 * Client instance of the shared cookie-session client from `@repo/utils` (ofetch, one shared
 * `POST /auth/refresh` + retry on 401). Paths are relative to the client realm root
 * `<API_BASE_URL>/v1/client`. When the session cannot be refreshed, the handlers registered with
 * `onSessionExpired` run.
 */
import { createApiClient, getErrorMessage } from '@repo/utils'
import { t } from '@/i18n'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100/api').replace(/\/+$/, '')

/** Versioned client app routes of apps/server; admin console routes live under `/v1/admin`. */
export const CLIENT_API_ROOT = '/v1/client'

const sessionExpiredHandlers = new Set<() => void>()

/** Registers what happens when the session cannot be refreshed (e.g. clear state, go to login). */
export function onSessionExpired(handler: () => void): () => void {
  sessionExpiredHandlers.add(handler)
  return () => sessionExpiredHandlers.delete(handler)
}

/** Plain object bodies are sent as JSON, `FormData` as multipart; errors are ofetch `FetchError`s. */
export const { fetch: api, refreshSession } = createApiClient({
  baseURL: `${API_BASE_URL}${CLIENT_API_ROOT}`,
  onUnauthorized: () => {
    for (const handler of sessionExpiredHandlers)
      handler()
  },
})

/** Server messages are shown as sent; the fallback follows the UI language. */
export function errorMessage(error: unknown, fallback = t('errors.generic')): string {
  return getErrorMessage(error, fallback)
}
