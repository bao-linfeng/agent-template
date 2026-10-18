/**
 * Client instance of the shared cookie-session client from `@repo/utils` (ofetch, one shared
 * `POST /auth/refresh` + retry on 401). Paths are relative to the client realm root
 * `<API_BASE_URL>/v1/client`. When the session cannot be refreshed, the handlers registered with
 * `onSessionExpired` run.
 *
 * Without `VITE_API_BASE_URL` the client calls `/api` on its own origin, which the Vite dev server
 * proxies to the API, so cookies stay same-site on localhost, 127.0.0.1 or a LAN IP alike.
 */
import { createApiClient, getErrorMessage } from '@repo/utils'
import { i18n, t } from '@/i18n'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

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

/**
 * Localized message for a failed request: error codes with an `apiErrors.<code>` message are translated
 * (with the body's `params`), other errors show the server message; the fallback follows the UI language.
 */
export function errorMessage(error: unknown, fallback = t('errors.generic')): string {
  return getErrorMessage(error, fallback, (code, params) => {
    const key = `apiErrors.${code}`
    return i18n.global.te(key) ? t(key, params) : undefined
  })
}
