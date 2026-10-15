import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiClient, FetchError, getErrorMessage, isUnauthorized } from '../api-client'

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

  it('does not retry other errors', async () => {
    route(() => respond(403, { message: 'Forbidden' }))

    const error = await client.fetch('/admin/users', { method: 'POST' }).catch(e => e)
    expect(isUnauthorized(error)).toBe(false)
    expect(getErrorMessage(error)).toBe('Forbidden')
    expect(fetchMock).toHaveBeenCalledTimes(1)
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
})
