import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiClient, createIdempotencyKey, FetchError, getErrorCode, getErrorMessage, isUnauthorized, REFRESH_SUPERSEDED } from '../api-client'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const BASE_URL = 'https://example.test/api'

afterAll(() => {
  vi.unstubAllGlobals()
})

function respond(status: number, body: unknown = { message: 'Service unavailable' }) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Routes mocked fetch calls by path: `handler(path, callIndexForPath)`. */
function route(handler: (path: string, call: number) => Response) {
  const calls = new Map<string, number>()
  fetchMock.mockImplementation((request: string | Request) => {
    const path = new URL(typeof request === 'string' ? request : request.url).pathname.replace(/^\/api/, '')
    const call = calls.get(path) ?? 0
    calls.set(path, call + 1)
    return Promise.resolve(handler(path, call))
  })
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([request]) => new URL(String(request)).pathname.endsWith(path)).length
}

describe('createApiClient', () => {
  const onUnauthorized = vi.fn()
  const client = createApiClient({ baseURL: BASE_URL, onUnauthorized })

  beforeEach(() => {
    fetchMock.mockReset()
    onUnauthorized.mockReset()
  })

  it('sends cookies and JSON to the base URL and parses the response', async () => {
    route(() => respond(200, { ok: true }))

    await expect(client.fetch('/users/me', { method: 'PATCH', body: { nickname: 'Ada' }, query: { page: 2 } }))
      .resolves
      .toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${BASE_URL}/users/me?page=2`)
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include', body: '{"nickname":"Ada"}' })
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('sends FormData untouched so the browser sets the multipart boundary', async () => {
    route(() => respond(200, {}))
    const body = new FormData()
    body.append('file', new Blob(['x']), 'a.png')

    await client.fetch('/users/me/avatar', { method: 'PUT', body })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.body).toBe(body)
    expect(new Headers(init.headers).has('content-type')).toBe(false)
  })

  it('refreshes an expired session once and retries the concurrent requests', async () => {
    route((path, call) => {
      if (path === '/auth/refresh')
        return respond(204)
      return call === 0 ? respond(401, { message: 'Unauthorized' }) : respond(200, { path })
    })

    await expect(Promise.all([client.fetch('/tasks/1'), client.fetch('/tasks/2')])).resolves.toEqual([
      { path: '/tasks/1' },
      { path: '/tasks/2' },
    ])
    expect(callsTo('/auth/refresh')).toBe(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('calls onUnauthorized when the session cannot be refreshed', async () => {
    route(() => respond(401, { message: 'Unauthorized' }))

    await expect(client.fetch('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(callsTo('/auth/refresh')).toBe(1)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('calls onUnauthorized when the retried request is still unauthorized', async () => {
    route(path => (path === '/auth/refresh' ? respond(204) : respond(401, { message: 'Unauthorized' })))

    await expect(client.fetch('/tasks/1')).rejects.toMatchObject({ status: 401 })
    expect(callsTo('/tasks/1')).toBe(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('awaits onUnauthorized before rethrowing', async () => {
    route(() => respond(401, { message: 'Unauthorized' }))
    const order: string[] = []
    onUnauthorized.mockImplementation(async () => {
      await Promise.resolve()
      order.push('signed out')
    })

    await client.fetch('/users/me').catch(() => order.push('rejected'))
    expect(order).toEqual(['signed out', 'rejected'])
  })

  it.each(['/auth/login', '/auth/register', '/auth/reset-password'])(
    'passes credential errors from %s through without refreshing',
    async (path) => {
      route(() => respond(401, { message: 'Email or password is incorrect' }))

      await expect(client.fetch(path, { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
      expect(callsTo('/auth/refresh')).toBe(0)
      expect(onUnauthorized).not.toHaveBeenCalled()
    },
  )

  it('does not treat routes that merely start like credential endpoints as credential errors', async () => {
    route((path, call) => (path === '/auth/refresh' || call > 0 ? respond(204) : respond(401)))

    await client.fetch('/auth/login-history')
    expect(callsTo('/auth/refresh')).toBe(1)
  })

  it('retries a refresh that another tab superseded instead of signing out', async () => {
    route((path, call) => {
      if (path === '/auth/refresh') {
        return call === 0
          ? respond(409, { statusCode: 409, code: REFRESH_SUPERSEDED, message: 'Superseded' })
          : respond(204)
      }
      return call === 0 ? respond(401, { message: 'Unauthorized' }) : respond(200, { ok: true })
    })

    await expect(client.fetch('/users/me')).resolves.toEqual({ ok: true })
    expect(callsTo('/auth/refresh')).toBe(2)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('gives up on a refresh that stays superseded', async () => {
    vi.useFakeTimers()
    try {
      route(path => path === '/auth/refresh'
        ? respond(409, { statusCode: 409, code: REFRESH_SUPERSEDED, message: 'Superseded' })
        : respond(401, { message: 'Unauthorized' }))

      const result = client.fetch('/users/me').catch(error => error)
      await vi.runAllTimersAsync()
      expect(await result).toMatchObject({ status: 401 })
      expect(callsTo('/auth/refresh')).toBe(4)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('refreshes under a lock shared by the tabs of the realm', async () => {
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task())
    vi.stubGlobal('navigator', { locks: { request } })
    try {
      route((path, call) => (path === '/auth/refresh' || call > 0 ? respond(204) : respond(401)))

      await client.fetch('/users/me')
      expect(request).toHaveBeenCalledTimes(1)
      expect(request.mock.calls[0]![0]).toBe(`@repo/utils:session-refresh:${BASE_URL}/auth`)
    }
    finally {
      vi.unstubAllGlobals()
      vi.stubGlobal('fetch', fetchMock)
    }
  })

  it('refreshes without Web Locks too', async () => {
    vi.stubGlobal('navigator', {})
    try {
      route((path, call) => (path === '/auth/refresh' || call > 0 ? respond(204) : respond(401)))

      await client.fetch('/users/me')
      expect(callsTo('/auth/refresh')).toBe(1)
    }
    finally {
      vi.unstubAllGlobals()
      vi.stubGlobal('fetch', fetchMock)
    }
  })

  it('does not retry other errors', async () => {
    route(() => respond(403, { message: 'Forbidden' }))

    const error = await client.fetch('/admin/users', { method: 'POST' }).catch(e => e)
    expect(isUnauthorized(error)).toBe(false)
    expect(getErrorMessage(error)).toBe('Forbidden')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('idempotency keys', () => {
  const client = createApiClient({ baseURL: BASE_URL })
  const UUID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/

  beforeEach(() => {
    fetchMock.mockReset()
  })

  function sentKeys() {
    return fetchMock.mock.calls
      .filter(([request]) => !String(request).endsWith('/auth/refresh'))
      .map(([, init]) => new Headers(init.headers).get('idempotency-key'))
  }

  it('sends no key unless asked', async () => {
    route(() => respond(200, {}))

    await client.fetch('/kb', { method: 'POST', body: {} })
    await client.fetch('/kb', { method: 'POST', body: {}, idempotencyKey: false })
    expect(sentKeys()).toEqual([null, null])
  })

  it('generates one key per call and reuses it for the retry after a refresh', async () => {
    route((path, call) => {
      if (path === '/auth/refresh')
        return respond(204)
      return path === '/kb' && call === 0 ? respond(401) : respond(201, {})
    })

    await client.fetch('/kb', { method: 'POST', body: { name: 'a' }, idempotencyKey: true })
    await client.fetch('/other', { method: 'POST', body: {}, idempotencyKey: true })
    const [first, retry, other] = sentKeys()
    expect(first).toMatch(UUID)
    expect(retry).toBe(first)
    expect(other).toMatch(UUID)
    expect(other).not.toBe(first)
  })

  it('uses a given key and keeps other headers', async () => {
    route(() => respond(201, {}))
    const key = createIdempotencyKey()

    await client.fetch('/kb', { method: 'POST', body: {}, headers: { 'X-Trace': '1' }, idempotencyKey: key })
    await client.fetch('/kb', { method: 'POST', body: {}, headers: { 'Idempotency-Key': 'explicit' }, idempotencyKey: key })
    expect(sentKeys()).toEqual([key, 'explicit'])
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get('x-trace')).toBe('1')
  })

  it('creates UUID v4 keys without crypto.randomUUID (insecure contexts)', () => {
    const { crypto } = globalThis
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    try {
      const key = createIdempotencyKey()
      expect(key).toMatch(UUID)
      expect(createIdempotencyKey()).not.toBe(key)
    }
    finally {
      vi.stubGlobal('crypto', crypto)
    }
  })
})

describe('createApiClient with a custom authPath', () => {
  const onUnauthorized = vi.fn()
  const client = createApiClient({ baseURL: BASE_URL, authPath: '/admin/auth', onUnauthorized })

  beforeEach(() => {
    fetchMock.mockReset()
    onUnauthorized.mockReset()
  })

  it('refreshes through the realm\'s auth routes', async () => {
    route((path, call) => {
      if (path === '/admin/auth/refresh')
        return respond(204)
      return call === 0 ? respond(401, { message: 'Unauthorized' }) : respond(200, { path })
    })

    await expect(client.fetch('/admin/me')).resolves.toEqual({ path: '/admin/me' })
    expect(callsTo('/admin/auth/refresh')).toBe(1)
    expect(fetchMock.mock.calls.some(([request]) => new URL(String(request)).pathname === '/api/auth/refresh')).toBe(false)
  })

  it('passes credential errors of its own auth routes through without refreshing', async () => {
    route(() => respond(401, { message: 'Email or password is incorrect' }))

    await expect(client.fetch('/admin/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
    expect(callsTo('/admin/auth/refresh')).toBe(0)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('getErrorMessage', () => {
  function fetchError(data: unknown, statusText = 'Bad Request') {
    const error = new FetchError('failed')
    Object.assign(error, { data, statusText, response: new Response(null, { status: 400 }) })
    return error
  }

  it('joins Nest validation messages', () => {
    expect(getErrorMessage(fetchError({ message: ['email must be an email', 'password too short'] })))
      .toBe('email must be an email; password too short')
  })

  it('falls back to the status text, the error message and the default', () => {
    expect(getErrorMessage(fetchError({ message: 'Conflict!' }))).toBe('Conflict!')
    expect(getErrorMessage(fetchError(undefined, 'Too Many Requests'))).toBe('Too Many Requests')
    expect(getErrorMessage(new Error('offline'))).toBe('offline')
    expect(getErrorMessage('nope', 'Default')).toBe('Default')
  })

  it('translates by code and interpolates params', () => {
    const error = fetchError({ statusCode: 413, code: 'UPLOAD_TOO_LARGE', message: 'File exceeds the 10 byte limit', params: { maxBytes: 10 } })
    const translate = vi.fn((code: string, params: Record<string, string | number>) =>
      code === 'UPLOAD_TOO_LARGE' ? `文件超过 ${params.maxBytes} 字节` : undefined)

    expect(getErrorCode(error)).toBe('UPLOAD_TOO_LARGE')
    expect(getErrorMessage(error, 'Default', translate)).toBe('文件超过 10 字节')
    expect(translate).toHaveBeenCalledWith('UPLOAD_TOO_LARGE', { maxBytes: 10 })
  })

  it('keeps the server message when a code has no translation', () => {
    const error = fetchError({ statusCode: 409, code: 'SOMETHING_NEW', message: 'Something new happened' })
    expect(getErrorMessage(error, 'Default', () => undefined)).toBe('Something new happened')
    expect(getErrorCode(fetchError({ message: 'no code' }))).toBeUndefined()
    expect(getErrorCode(new Error('plain'))).toBeUndefined()
  })

  it('explains requests that got no response', async () => {
    const client = createApiClient({ baseURL: BASE_URL, timeout: 10 })

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(getErrorMessage(await client.fetch('/users/me', { retry: 0 }).catch(e => e)))
      .toBe('Cannot reach the server. Please check your connection.')

    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    }))
    expect(getErrorMessage(await client.fetch('/users/me', { retry: 0 }).catch(e => e)))
      .toBe('The server took too long to respond.')
  })

  it('gives requests without a response a client-side code', async () => {
    const client = createApiClient({ baseURL: BASE_URL, timeout: 10 })
    const translate = (code: string) => ({ NETWORK_ERROR: '网络不可用', TIMEOUT: '请求超时' })[code]

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const offline = await client.fetch('/users/me', { retry: 0 }).catch(e => e)
    expect(getErrorCode(offline)).toBe('NETWORK_ERROR')
    expect(getErrorMessage(offline, 'Default', translate)).toBe('网络不可用')

    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    }))
    const slow = await client.fetch('/users/me', { retry: 0 }).catch(e => e)
    expect(getErrorCode(slow)).toBe('TIMEOUT')
    expect(getErrorMessage(slow, 'Default', translate)).toBe('请求超时')
  })
})
