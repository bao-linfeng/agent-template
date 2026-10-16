/**
 * Cookie-session HTTP client for apps/server, built on ofetch: https://github.com/unjs/ofetch
 *
 * The server authenticates with HttpOnly cookies, so every request is sent with
 * `credentials: 'include'`. A 401 triggers one shared `POST <authPath>/refresh` and a single retry; if
 * the refresh fails too, `onUnauthorized` decides what happens to the local session. Client users and
 * admin console accounts are separate realms, each under its own versioned root (`/v1/client`,
 * `/v1/admin`) with its own `/auth` routes; point `baseURL` at the realm root. Requests may carry an
 * `Idempotency-Key` (option `idempotencyKey`) for server routes marked `@Idempotent()`.
 */
import type { FetchOptions } from 'ofetch'

import { FetchError, ofetch } from 'ofetch'

export { FetchError }
export type { FetchOptions }

/** Request header read by server routes marked `@Idempotent()`. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key'

/** Credential endpoints answer 401 for wrong input, not for an expired session. */
const CREDENTIAL_ENDPOINTS = ['login', 'register', 'refresh', 'logout', 'forgot-password', 'reset-password']

export interface ApiClientOptions {
  /** Realm root including the API prefix and version, e.g. `http://localhost:3100/api/v1/client`. */
  baseURL: string
  /** Auth routes of the account realm, relative to `baseURL` (default `/auth`). */
  authPath?: string
  timeout?: number
  /** Called when a 401 cannot be recovered by refreshing; awaited before the error is rethrown. */
  onUnauthorized?: () => unknown
}

export type ApiFetchOptions = FetchOptions<'json'> & {
  /**
   * Sends `Idempotency-Key` so the server runs the operation at most once. `true` generates a key for
   * this call, shared by its retry after a session refresh. To make user resubmits safe (double
   * click, retry after a network error), create one key per operation with `createIdempotencyKey()`
   * and pass it on every attempt. An `Idempotency-Key` already in `headers` wins.
   */
  idempotencyKey?: string | boolean
}

export type ApiFetch = <T = any>(request: string, options?: ApiFetchOptions) => Promise<T>

export interface ApiClient {
  fetch: ApiFetch
  /** Rotates the session cookies. Concurrent callers share one request. */
  refreshSession: () => Promise<boolean>
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof FetchError && error.status === 401
}

/** Random UUID v4 for `idempotencyKey`; also works outside secure contexts, where `crypto.randomUUID` is missing. */
export function createIdempotencyKey(): string {
  if (typeof globalThis.crypto.randomUUID === 'function')
    return globalThis.crypto.randomUUID()
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0F) | 0x40
  bytes[8] = (bytes[8]! & 0x3F) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function toFetchOptions(options?: ApiFetchOptions): FetchOptions<'json'> | undefined {
  if (!options)
    return options
  const { idempotencyKey, ...rest } = options
  if (!idempotencyKey)
    return rest
  const headers = new Headers(rest.headers)
  if (!headers.has(IDEMPOTENCY_KEY_HEADER))
    headers.set(IDEMPOTENCY_KEY_HEADER, idempotencyKey === true ? createIdempotencyKey() : idempotencyKey)
  return { ...rest, headers }
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

  async function apiFetch<T = any>(request: string, apiOptions?: ApiFetchOptions): Promise<T> {
    // Resolved once, so a retry after refreshing the session reuses the same idempotency key.
    const options = toFetchOptions(apiOptions)
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

/** Body of every apps/server error response; clients translate by `code`. */
export interface ApiErrorBody {
  statusCode: number
  code: string
  /** English message, used when there is no translation for `code`. */
  message: string
  /** Values a translation may interpolate. */
  params?: Record<string, string | number>
  details?: unknown
}

/** Client-side codes for requests that never got a response. */
export const NETWORK_ERROR = 'NETWORK_ERROR'
export const TIMEOUT_ERROR = 'TIMEOUT'

/** Returns the localized message for an error code, or `undefined` to keep the server message. */
export type ErrorTranslator = (code: string, params: Record<string, string | number>) => string | undefined

function isTimeout(error: FetchError): boolean {
  return (error.cause as Error | undefined)?.name === 'TimeoutError'
}

/** Machine-readable code of a failed request: the server's `code`, or `NETWORK_ERROR`/`TIMEOUT` without a response. */
export function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof FetchError))
    return undefined
  if (!error.response)
    return isTimeout(error) ? TIMEOUT_ERROR : NETWORK_ERROR
  const code: unknown = error.data?.code
  return typeof code === 'string' && code ? code : undefined
}

/**
 * Human readable message for a failed request. With `translate`, known codes are localized;
 * otherwise the server message (a list of messages is joined), then the status text, then `fallback`.
 */
export function getErrorMessage(error: unknown, fallback = 'Request failed', translate?: ErrorTranslator): string {
  const code = getErrorCode(error)
  if (code && translate) {
    const params: unknown = error instanceof FetchError ? error.data?.params : undefined
    const translated = translate(code, params && typeof params === 'object' ? params as Record<string, string | number> : {})
    if (translated)
      return translated
  }
  if (error instanceof FetchError) {
    if (!error.response) {
      return isTimeout(error)
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
