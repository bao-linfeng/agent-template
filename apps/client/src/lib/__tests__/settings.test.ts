import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { isRegistrationOpen, settingsApi } from '../settings'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('public settings', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('reads them from the client realm', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ 'auth.registrationEnabled': false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    expect(await settingsApi.get()).toEqual({ 'auth.registrationEnabled': false })
    expect(new URL(fetchMock.mock.calls[0]![0] as string).pathname).toMatch(/\/v1\/client\/settings$/)
  })

  it('treats registration as open unless the server says it is closed', () => {
    expect(isRegistrationOpen({ 'auth.registrationEnabled': false })).toBe(false)
    expect(isRegistrationOpen({ 'auth.registrationEnabled': true })).toBe(true)
    expect(isRegistrationOpen(undefined)).toBe(true)
    expect(isRegistrationOpen({})).toBe(true)
  })
})
