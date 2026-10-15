import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, API_BASE_URL, ApiError, errorMessage, onSessionExpired } from '../api'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const expired = vi.fn()
onSessionExpired(expired)

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Routes calls by path: `handler(path, callIndexForPath)`. */
function route(handler: (path: string, call: number) => Response) {
  const calls = new Map<string, number>()
  fetchMock.mockImplementation((url: string) => {
    const path = new URL(url).pathname.replace(/^\/api/, '')
    const call = calls.get(path) ?? 0
    calls.set(path, call + 1)
    return Promise.resolve(handler(path, call))
  })
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => new URL(url as string).pathname.endsWith(path)).length
}

describe('api', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    expired.mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('sends JSON with cookies and parses the response', async () => {
    route(() => respond(200, { ok: true }))

    await expect(api('/users/me', { method: 'PATCH', body: { nickname: 'Ada' }, query: { a: 1, b: '' } }))
      .resolves
      .toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${API_BASE_URL}/users/me?a=1`)
    expect(init).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{"nickname":"Ada"}',
    })
  })

  it('sends FormData as multipart without a JSON content type', async () => {
    route(() => respond(200, {}))
    const body = new FormData()
    body.append('file', new Blob(['x']), 'a.png')

    await api('/users/me/avatar', { method: 'PUT', body })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.body).toBe(body)
    expect(init.headers).toBeUndefined()
  })

  it('turns Nest errors into ApiError with a readable message', async () => {
    route(() => respond(400, { message: ['email must be an email', 'password is too short'] }))

    const error = await api('/auth/register', { method: 'POST', body: {} }).catch(e => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'email must be an email; password is too short' })
    expect(errorMessage(error)).toBe('email must be an email; password is too short')
  })

  it('reports network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(api('/users/me')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach') })
  })

  it('refreshes once for concurrent 401s and retries', async () => {
    route((path, call) => {
      if (path === '/auth/refresh')
        return respond(204)
      return call === 0 ? respond(401, { message: 'Unauthorized' }) : respond(200, { path })
    })

    await expect(Promise.all([api('/a'), api('/b')])).resolves.toEqual([{ path: '/a' }, { path: '/b' }])
    expect(callsTo('/auth/refresh')).toBe(1)
    expect(expired).not.toHaveBeenCalled()
  })

  it('reports an expired session when the refresh fails', async () => {
    route(() => respond(401, { message: 'Unauthorized' }))

    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(callsTo('/auth/refresh')).toBe(1)
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('does not refresh for credential endpoints', async () => {
    route(() => respond(401, { message: 'Email or password is incorrect' }))

    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'Email or password is incorrect',
    })
    expect(callsTo('/auth/refresh')).toBe(0)
    expect(expired).not.toHaveBeenCalled()
  })
})
