import { FetchError } from '@repo/utils'
import { useQueryClient } from '@tanstack/vue-query'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'

import type { IUserProfile } from '@/services/types/user.type'

import { apiFetch, getErrorMessage } from '@/lib/api-client'
import pinia from '@/plugins/pinia/setup'
import { setupTanstackVueQuery } from '@/plugins/tanstack-vue-query/setup'
import { useAuthStore } from '@/stores/auth'

const { fetchMock, notify, push, currentRoute } = vi.hoisted(() => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, notify: vi.fn(), push: vi.fn(), currentRoute: { value: { fullPath: '/users?page=2' } } }
})

vi.mock('vue-sonner', () => ({ toast: { error: notify } }))
vi.mock('@/router', () => ({ default: { push, currentRoute } }))
vi.mock('@/constants/app-config', () => ({ API_BASE_URL: 'https://example.test/api', API_TIMEOUT: 5000 }))
vi.mock('@/plugins/pinia/setup', async () => {
  const { createPinia } = await import('pinia')
  return { default: createPinia() }
})

const app = createApp({})
setupTanstackVueQuery(app)
const queryClient = app.runWithContext(() => useQueryClient())
const authStore = useAuthStore(pinia)

const profile: IUserProfile = {
  id: 'u1',
  email: 'ada@example.com',
  nickname: 'Ada',
  avatarUrl: null,
  status: 'active',
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: ['user'],
  permissions: [],
}

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
    const path = new URL(typeof request === 'string' ? request : request.url).pathname.replace(/^\/api\/v1\/admin/, '')
    const call = calls.get(path) ?? 0
    calls.set(path, call + 1)
    return Promise.resolve(handler(path, call))
  })
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([request]) => String(request).endsWith(path)).length
}

function fetchQuery() {
  return queryClient.fetchQuery({
    queryKey: ['tasks'],
    queryFn: () => apiFetch('/tasks'),
    retry: 1,
    retryDelay: 0,
  })
}

describe('aPI error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    authStore.setUser(profile)
  })

  afterEach(() => {
    queryClient.clear()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('sends cookies with every request', async () => {
    route(() => respond(200, { ok: true }))

    await apiFetch('/me')
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://example.test/api/v1/admin/me')
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: 'include' })
  })

  it.each([
    [503, 200],
    [503, 503, 200],
  ])('does not notify when retries recover (%j)', async (...statuses) => {
    fetchMock.mockImplementation(() => respond(statuses.shift()!))

    await expect(fetchQuery()).resolves.toBeDefined()
    expect(notify).not.toHaveBeenCalled()
  })

  it('notifies once after both fetch and query retries are exhausted', async () => {
    fetchMock.mockImplementation(() => {
      expect(notify).not.toHaveBeenCalled()
      return respond(503)
    })

    await expect(fetchQuery()).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(notify).toHaveBeenCalledExactlyOnceWith('Service unavailable')
  })

  it('notifies once after mutation retries are exhausted', async () => {
    fetchMock.mockImplementation(() => respond(503))
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => apiFetch('/tasks', { method: 'post' }),
      retry: 1,
      retryDelay: 0,
    })

    await expect(mutation.execute(undefined)).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledExactlyOnceWith('Service unavailable')
  })

  it('refreshes an expired session once and retries the concurrent requests', async () => {
    route((path, call) => {
      if (path === '/auth/refresh')
        return respond(204)
      return call === 0 ? respond(401, { message: 'Unauthorized' }) : respond(200, { path })
    })

    await expect(Promise.all([apiFetch('/tasks/1'), apiFetch('/tasks/2')])).resolves.toEqual([
      { path: '/tasks/1' },
      { path: '/tasks/2' },
    ])
    expect(callsTo('/auth/refresh')).toBe(1)
    expect(authStore.isLogin).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  it('signs out once per login when the session cannot be refreshed', async () => {
    route(() => respond(401, { message: 'Unauthorized' }))

    const results = await Promise.allSettled([fetchQuery(), apiFetch('/tasks/1')])
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(authStore.isLogin).toBe(false)
    expect(notify).toHaveBeenCalledExactlyOnceWith('Your session has expired, please sign in again.')
    expect(push).toHaveBeenCalledExactlyOnceWith({ path: '/auth/sign-in', query: { redirect: '/users?page=2' } })

    await expect(apiFetch('/tasks/2')).rejects.toMatchObject({ status: 401 })
    expect(push).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledTimes(1)

    authStore.setUser(profile)
    await expect(apiFetch('/tasks/3')).rejects.toMatchObject({ status: 401 })
    expect(authStore.isLogin).toBe(false)
    expect(push).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('signs out when the retried request is still unauthorized', async () => {
    route(path => (path === '/auth/refresh' ? respond(204) : respond(401, { message: 'Unauthorized' })))

    await expect(apiFetch('/tasks/1')).rejects.toMatchObject({ status: 401 })
    expect(callsTo('/tasks/1')).toBe(2)
    expect(authStore.isLogin).toBe(false)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it.each(['/auth/login', '/auth/forgot-password', '/auth/reset-password'])(
    'passes credential errors from %s through without refreshing',
    async (path) => {
      route(() => respond(401, { message: 'Email or password is incorrect' }))

      await expect(apiFetch(path, { method: 'post', body: {} })).rejects.toMatchObject({ status: 401 })
      expect(callsTo('/auth/refresh')).toBe(0)
      expect(authStore.isLogin).toBe(true)
      expect(push).not.toHaveBeenCalled()
    },
  )
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
})
