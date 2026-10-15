import type { RouteMeta } from 'vue-router'

import { describe, expect, it, vi } from 'vitest'

import { requiresAuth, resolveAuthRedirect } from '@/router/guard/auth-guard'

vi.mock('@/plugins/pinia/setup', () => ({ default: {} }))
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }))

const guest = { isLogin: false, can: () => false }
const admin = { isLogin: true, can: (permission: string) => permission === 'user:read' }

function to(path: string, meta: RouteMeta = {}) {
  return { path, fullPath: path, meta }
}

describe('requiresAuth', () => {
  it('protects dashboard layout pages by default', () => {
    expect(requiresAuth({})).toBe(true)
    expect(requiresAuth({ layout: 'default' })).toBe(true)
    expect(requiresAuth({ layout: { name: 'default' } })).toBe(true)
  })

  it('leaves pages with their own layout public unless they opt in', () => {
    expect(requiresAuth({ layout: false })).toBe(false)
    expect(requiresAuth({ layout: 'marketing' })).toBe(false)
    expect(requiresAuth({ layout: 'blank', auth: true })).toBe(true)
    expect(requiresAuth({ auth: false })).toBe(false)
  })
})

describe('resolveAuthRedirect', () => {
  it('sends guests to sign-in with the requested page', () => {
    expect(resolveAuthRedirect(to('/users?page=2'), to('/'), guest)).toEqual({
      path: '/auth/sign-in',
      query: { redirect: '/users?page=2' },
    })
    expect(resolveAuthRedirect(to('/auth/reset-password', { layout: false }), to('/'), guest)).toBeUndefined()
  })

  it('keeps signed-in users away from sign-in and sign-up', () => {
    expect(resolveAuthRedirect(to('/auth/sign-in', { layout: false }), to('/users'), admin)).toBe('/users')
    expect(resolveAuthRedirect(to('/auth/sign-up', { layout: false }), to('/'), admin)).toBe('/dashboard')
    expect(resolveAuthRedirect(to('/auth/sign-in', { layout: false }), to('/auth/sign-up'), admin)).toBe('/dashboard')
  })

  it('checks page permissions', () => {
    expect(resolveAuthRedirect(to('/users', { permission: 'user:read' }), to('/'), admin)).toBeUndefined()
    expect(resolveAuthRedirect(to('/roles', { permission: 'role:read' }), to('/'), admin)).toEqual({ path: '/errors/403' })
  })
})
