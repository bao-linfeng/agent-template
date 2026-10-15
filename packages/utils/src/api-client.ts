/**
 * Cookie-session HTTP client for apps/server, built on ofetch: https://github.com/unjs/ofetch
 *
 * The server authenticates with HttpOnly cookies, so every request is sent with
 * `credentials: 'include'`. A 401 triggers one shared `POST <authPath>/refresh` and a single retry; if
 * the refresh fails too, `onUnauthorized` decides what happens to the local session. Client users and
 * admin console accounts are separate realms with their own auth routes (`/auth`, `/admin/auth`).
 */
import type { FetchOptions } from 'ofetch'

import { FetchError, ofetch } from 'ofetch'

export { FetchError }
export type { FetchOptions }

/** Credential endpoints answer 401 for wrong input, not for an expired session. */
const CREDENTIAL_ENDPOINTS = ['login', 'register', 'refresh', 'logout', 'forgot-password', 'reset-password']

export interface ApiClientOptions {
  /** API root including the prefix, e.g. `http://localhost:3100/api`. */
  baseURL: string
  /** Auth routes of the account realm, relative to `baseURL`: `/auth` (client users, default) or `/admin/auth`. */
  authPath?: string
  timeout?: number
  /** Called when a 401 cannot be recovered by refreshing; awaited before the error is rethrown. */
  onUnauthorized?: () => unknown
}

export type ApiFetch = <T = any>(request: string, options?: FetchOptions<'json'>) => Promise<T>

export interface ApiClient {
  fetch: ApiFetch
  /** Rotates the session cookies. Concurrent callers share one request. */
  refreshSession: () => Promise<boolean>
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof FetchError && error.status === 401
}

export function createApiClient({ baseURL, authPath = '/auth', timeout = 15_000, onUnauthorized }: ApiClientOptions): ApiClient {
  const rawFetch = ofetch.create({ baseURL, timeout, credentials: 'include' })
  const credentialRoutes = new Set(CREDENTIAL_ENDPOINTS.map(endpoint => `${authPath}/${endpoint}`))

  let refreshing: Promise<boolean> | null = null

  function refreshSession(): Promise<boolean> {
    refreshing ??= rawFetch(`${authPath}/refresh`, { method: 'POST', retry: 0 })
      .then(() => true, () => false)
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  async function apiFetch<T = any>(request: string, options?: FetchOptions<'json'>): Promise<T> {
    try {
      return await rawFetch<T>(request, options)
    }
    catch (error) {
      if (!isUnauthorized(error) || credentialRoutes.has(request.split('?')[0]!))
        throw error

      if (await refreshSession()) {
        try {
          return await rawFetch<T>(request, options)
        }
        catch (retryError) {
          if (isUnauthorized(retryError))
            await onUnauthorized?.()
          throw retryError
        }
      }

      await onUnauthorized?.()
      throw error
    }
  }

  return { fetch: apiFetch, refreshSession }
}

/** Human readable message from a Nest error body (`message` may be a list of validation errors). */
export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof FetchError) {
    if (!error.response) {
      return (error.cause as Error | undefined)?.name === 'TimeoutError'
        ? 'The server took too long to respond.'
        : 'Cannot reach the server. Please check your connection.'
    }
    const message: unknown = error.data?.message
    if (Array.isArray(message) && message.length)
      return message.join('; ')
    if (typeof message === 'string' && message)
      return message
    return error.statusText || fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}
