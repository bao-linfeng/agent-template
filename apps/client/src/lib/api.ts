/**
 * Minimal fetch client for apps/server. The session lives in HttpOnly cookies (`access_token`,
 * `refresh_token`), so every request uses `credentials: 'include'`. A 401 triggers one shared
 * `POST /auth/refresh` and a single retry; when that fails too, `onSessionExpired` is called.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100/api').replace(/\/+$/, '')

const TIMEOUT_MS = 15_000

/** Credential endpoints answer 401 for wrong input, not for an expired session. */
const SKIP_REFRESH = /^\/auth\/(?:login|register|refresh|logout|forgot-password|reset-password)\b/

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Plain objects are sent as JSON; `FormData` as multipart. */
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  timeout?: number
}

const sessionExpiredHandlers = new Set<() => void>()

/** Registers what happens when the session cannot be refreshed (e.g. clear state, go to login). */
export function onSessionExpired(handler: () => void): () => void {
  sessionExpiredHandlers.add(handler)
  return () => sessionExpiredHandlers.delete(handler)
}

function sessionExpired() {
  for (const handler of sessionExpiredHandlers)
    handler()
}

/** Nest errors carry `message` as a string or a list of validation messages. */
function messageOf(data: unknown, fallback: string): string {
  const message = (data as { message?: unknown } | undefined)?.message
  if (Array.isArray(message) && message.length)
    return message.join('; ')
  return typeof message === 'string' && message ? message : fallback
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '')
      url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function send<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, query, timeout = TIMEOUT_MS } = options
  const isForm = body instanceof FormData
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    })
  }
  catch (error) {
    throw new ApiError(0, error instanceof DOMException && error.name === 'TimeoutError'
      ? 'The server took too long to respond.'
      : 'Cannot reach the server. Please check your connection.')
  }

  const text = response.status === 204 ? '' : await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  }
  catch {
    data = text
  }
  if (!response.ok)
    throw new ApiError(response.status, messageOf(data, response.statusText || 'Request failed'), data)
  return data as T
}

let refreshing: Promise<boolean> | null = null

/** Rotates the session cookies; concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then(() => true, () => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options)
  }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || SKIP_REFRESH.test(path))
      throw error
    if (await refreshSession()) {
      try {
        return await send<T>(path, options)
      }
      catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401)
          sessionExpired()
        throw retryError
      }
    }
    sessionExpired()
    throw error
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong, please try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}
