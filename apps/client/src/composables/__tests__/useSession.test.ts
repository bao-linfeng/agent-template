import type { UserProfile } from '@/lib/account'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const accountApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  uploadAvatar: vi.fn(),
  updateProfile: vi.fn(),
  removeAvatar: vi.fn(),
}))
vi.mock('@/lib/account', () => ({ accountApi }))

const profile: UserProfile = {
  id: 'u1',
  email: 'ada@example.com',
  nickname: 'Ada',
  avatarUrl: null,
  status: 'active',
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

// The composable keeps module-level state; load a fresh copy for each test.
async function loadUseSession() {
  vi.resetModules()
  return (await import('../useSession')).useSession
}

describe('useSession', () => {
  beforeEach(() => {
    for (const fn of Object.values(accountApi))
      fn.mockReset()
  })

  it('restores an existing cookie session once', async () => {
    accountApi.me.mockResolvedValue(profile)
    const session = (await loadUseSession())()

    await Promise.all([session.restore(), session.restore()])
    expect(accountApi.me).toHaveBeenCalledTimes(1)
    expect(session.isLoggedIn.value).toBe(true)
    expect(session.initialized.value).toBe(true)
  })

  it('treats a failed restore as signed out', async () => {
    accountApi.me.mockRejectedValue(new Error('401'))
    const session = (await loadUseSession())()

    await session.restore()
    expect(session.isLoggedIn.value).toBe(false)
    expect(session.initialized.value).toBe(true)
  })

  it('registers and uploads the chosen avatar with the new session', async () => {
    const withAvatar = { ...profile, avatarUrl: 'http://localhost:3100/api/avatars/u1/a.png' }
    accountApi.register.mockResolvedValue(profile)
    accountApi.uploadAvatar.mockResolvedValue(withAvatar)
    const session = (await loadUseSession())()
    const avatar = new File(['x'], 'a.png', { type: 'image/png' })

    await expect(session.register({ email: profile.email, password: 'password1', nickname: 'Ada' }, avatar))
      .resolves
      .toBeUndefined()
    expect(accountApi.uploadAvatar).toHaveBeenCalledWith(avatar, 'a.png')
    expect(session.user.value?.avatarUrl).toBe(withAvatar.avatarUrl)
  })

  it('keeps the new account when only the avatar upload fails', async () => {
    accountApi.register.mockResolvedValue(profile)
    accountApi.uploadAvatar.mockRejectedValue(new Error('Unsupported image type'))
    const session = (await loadUseSession())()

    await expect(session.register({ email: profile.email, password: 'password1', nickname: 'Ada' }, new File(['x'], 'a.png')))
      .resolves
      .toBe('Unsupported image type')
    expect(session.user.value).toEqual(profile)
  })

  it('clears the local session even when logout fails', async () => {
    accountApi.login.mockResolvedValue(profile)
    accountApi.logout.mockRejectedValue(new Error('offline'))
    const session = (await loadUseSession())()

    await session.login({ email: profile.email, password: 'password1' })
    expect(session.isLoggedIn.value).toBe(true)
    await expect(session.logout()).rejects.toThrow('offline')
    expect(session.isLoggedIn.value).toBe(false)
  })
})
