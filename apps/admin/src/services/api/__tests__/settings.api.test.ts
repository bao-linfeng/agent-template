import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSettings, updateSettings } from '../settings.api'

const apiFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', () => ({ apiFetch }))

describe('settings transport', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
  })

  it('lists the settings', async () => {
    await fetchSettings()
    expect(apiFetch).toHaveBeenCalledWith('/settings', { method: 'get' })
  })

  it('sends changes wrapped in `values`, null resetting a setting', async () => {
    await updateSettings({ 'account.deletionGraceDays': 3, 'auth.registrationEnabled': null })
    expect(apiFetch).toHaveBeenCalledWith('/settings', {
      method: 'patch',
      body: { values: { 'account.deletionGraceDays': 3, 'auth.registrationEnabled': null } },
    })
  })
})
