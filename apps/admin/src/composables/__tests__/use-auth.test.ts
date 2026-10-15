import { describe, expect, it, vi } from 'vitest'

import { safeRedirect } from '@/composables/use-auth'

vi.mock('@/services/api/auth.api', () => ({}))
vi.mock('@/services/api/me.api', () => ({}))
vi.mock('@/lib/api-client', () => ({ getErrorMessage: vi.fn() }))

describe('safeRedirect', () => {
  it('accepts in-app paths', () => {
    expect(safeRedirect('/users?page=2')).toBe('/users?page=2')
    expect(safeRedirect('/settings/account')).toBe('/settings/account')
  })

  it('falls back to the dashboard for missing or external targets', () => {
    for (const target of [undefined, '', 'https://evil.test', '//evil.test', '/\\evil.test', ['/users']])
      expect(safeRedirect(target)).toBe('/dashboard')
  })
})
