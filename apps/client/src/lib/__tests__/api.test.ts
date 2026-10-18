import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { api, API_BASE_URL, errorMessage, onSessionExpired } from '../api'

// Transport behaviour (JSON/FormData, refresh + retry) is covered by `@repo/utils`; this checks the wiring.
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

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => new URL(url as string, 'http://localhost').pathname.endsWith(path)).length
}

describe('api', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    expired.mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('sends requests with cookies to the server API', async () => {
    fetchMock.mockResolvedValue(respond(200, { ok: true }))

    await expect(api('/users/me')).resolves.toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${API_BASE_URL}/v1/client/users/me`)
    expect(init).toMatchObject({ credentials: 'include' })
  })

  it('turns Nest errors into a readable message', async () => {
    fetchMock.mockResolvedValue(respond(400, { message: ['email must be an email', 'password is too short'] }))

    const error = await api('/auth/register', { method: 'POST', body: {} }).catch(e => e)
    expect(error).toMatchObject({ status: 400 })
    expect(errorMessage(error)).toBe('email must be an email; password is too short')
    expect(errorMessage(undefined)).toBe('Something went wrong, please try again.')
  })

  describe('with error codes', () => {
    afterEach(() => {
      i18n.global.locale.value = 'en'
    })

    it('translates known codes into the UI language with their params', async () => {
      fetchMock.mockResolvedValue(respond(429, {
        statusCode: 429,
        code: 'AUTH_CODE_RESEND_TOO_SOON',
        message: 'A code was sent recently, please wait before requesting another one',
        params: { retryAfter: 42 },
      }))

      const error = await api('/auth/register/send-code', { method: 'POST', body: {} }).catch(e => e)
      expect(errorMessage(error)).toBe('A code was sent recently, please try again in 42 seconds.')
      i18n.global.locale.value = 'zh'
      expect(errorMessage(error)).toBe('验证码刚刚发送过，请 42 秒后再试。')
    })

    it('shows the server message for codes without a translation', async () => {
      fetchMock.mockResolvedValue(respond(400, { statusCode: 400, code: 'AUTH_BEARER_REQUIRED', message: 'Bearer required' }))

      const error = await api('/auth/logout', { method: 'POST', body: {} }).catch(e => e)
      i18n.global.locale.value = 'zh'
      expect(errorMessage(error)).toBe('Bearer required')
    })
  })

  it('notifies the session-expired handlers when the refresh fails', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(respond(401, { message: 'Unauthorized' })))

    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(callsTo('/auth/refresh')).toBe(1)
    expect(expired).toHaveBeenCalledTimes(1)
  })
})
