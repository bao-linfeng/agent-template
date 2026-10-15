// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { resolveAccessRedirect, routes } from '../index'

vi.mock('@/composables/useSession', () => ({ useSession: vi.fn() }))

function to(fullPath: string) {
  const record = routes.find(route => route.path === fullPath.split('?')[0])
  return { fullPath, meta: record?.meta ?? {} }
}

describe('account routes', () => {
  it('sends guests from the account page to login', () => {
    expect(resolveAccessRedirect(to('/account'), false)).toEqual({ path: '/login', query: { redirect: '/account' } })
    expect(resolveAccessRedirect(to('/account'), true)).toBeUndefined()
  })

  it('keeps signed-in users away from login and register', () => {
    expect(resolveAccessRedirect(to('/login'), true)).toEqual({ path: '/account' })
    expect(resolveAccessRedirect(to('/register'), true)).toEqual({ path: '/account' })
    expect(resolveAccessRedirect(to('/login'), false)).toBeUndefined()
  })

  it('leaves public and password reset pages open to everyone', () => {
    for (const path of ['/', '/forgot-password', '/reset-password?token=abc']) {
      expect(resolveAccessRedirect(to(path), false)).toBeUndefined()
      expect(resolveAccessRedirect(to(path), true)).toBeUndefined()
    }
  })
})
