import { FetchError } from '@repo/utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IUserProfile } from '@/services/types/user.type'

import { safeRedirect, useAuth } from '@/composables/use-auth'
import { useAuthStore } from '@/stores/auth'

const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  loginMfa: vi.fn(),
  logout: vi.fn(),
  isMfaChallenge: (result: object) => 'mfaRequired' in result,
}))
const router = vi.hoisted(() => ({
  push: vi.fn(),
  currentRoute: { value: { query: {} as Record<string, string> } },
}))

vi.mock('@/services/api/auth.api', () => authApi)
vi.mock('@/services/api/me.api', () => ({}))
vi.mock('@/lib/api-client', () => ({ getErrorMessage: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('@tanstack/vue-query', () => ({ useQueryClient: () => ({ clear: vi.fn() }) }))
vi.mock('@/lib/query-client', () => ({ queryClient: { removeQueries: vi.fn() } }))

const profile: IUserProfile = {
  id: 'a1',
  email: 'ada@example.com',
  nickname: 'Ada',
  avatarUrl: null,
  status: 'active',
  lastLoginAt: null,
  deletionScheduledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: [],
  permissions: [],
  mfaEnabled: true,
}

function apiError(code: string) {
  const error = new FetchError('failed')
  Object.assign(error, { data: { code }, response: new Response(null, { status: 400 }) })
  return error
}

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

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    router.currentRoute.value.query = { redirect: '/users' }
  })

  it('signs in directly without a second factor', async () => {
    authApi.login.mockResolvedValue({ ...profile, mfaEnabled: false })
    const { login } = useAuth()

    await login({ email: 'ada@example.com', password: 'pw' })

    expect(useAuthStore().user?.id).toBe('a1')
    expect(router.push).toHaveBeenCalledWith('/users')
  })

  it('continues on the code page when the server asks for a second factor', async () => {
    authApi.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'c1', expiresIn: 300 })
    authApi.loginMfa.mockResolvedValue(profile)
    const { login, verifyMfa } = useAuth()
    const authStore = useAuthStore()

    await login({ email: 'ada@example.com', password: 'pw' })

    expect(authStore.isLogin).toBe(false)
    expect(authStore.activeMfa()).toMatchObject({ challengeToken: 'c1', email: 'ada@example.com' })
    expect(router.push).toHaveBeenCalledWith({ path: '/auth/otp', query: { redirect: '/users' } })

    await verifyMfa('123456')

    expect(authApi.loginMfa).toHaveBeenCalledWith({ challengeToken: 'c1', code: '123456' })
    expect(authStore.user?.id).toBe('a1')
    expect(authStore.pendingMfa).toBeNull()
    expect(router.push).toHaveBeenLastCalledWith('/users')
  })

  it('keeps the challenge after a wrong code and drops it when the server forgot it', async () => {
    const authStore = useAuthStore()
    authStore.setPendingMfa({ mfaRequired: true, challengeToken: 'c1', expiresIn: 300 }, 'ada@example.com')
    const { verifyMfa } = useAuth()

    authApi.loginMfa.mockRejectedValueOnce(apiError('AUTH_MFA_CODE_INVALID'))
    await expect(verifyMfa('000000')).rejects.toBeInstanceOf(FetchError)
    expect(authStore.pendingMfa).not.toBeNull()

    authApi.loginMfa.mockRejectedValueOnce(apiError('AUTH_MFA_CHALLENGE_INVALID'))
    await expect(verifyMfa('111111')).rejects.toBeInstanceOf(FetchError)
    expect(authStore.pendingMfa).toBeNull()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('does not call the server once the challenge has expired locally', async () => {
    const authStore = useAuthStore()
    authStore.setPendingMfa({ mfaRequired: true, challengeToken: 'c1', expiresIn: 300 }, 'ada@example.com', Date.now() - 301_000)
    const { verifyMfa } = useAuth()

    await verifyMfa('123456')

    expect(authApi.loginMfa).not.toHaveBeenCalled()
    expect(authStore.pendingMfa).toBeNull()
  })
})
