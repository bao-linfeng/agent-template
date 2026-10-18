import type { UserProfile } from '@/lib/account'
import { FetchError } from '@repo/utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { useSessionStore } from '../session'

const accountApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  restoreAccount: vi.fn(),
  requestDeletion: vi.fn(),
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
  deletionScheduledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('session store', () => {
  beforeEach(() => {
    // A fresh Pinia gives every test its own store state.
    setActivePinia(createPinia())
    queryClient.clear()
    for (const fn of Object.values(accountApi))
      fn.mockReset()
  })

  it('restores an existing cookie session once', async () => {
    accountApi.me.mockResolvedValue(profile)
    const session = useSessionStore()

    await Promise.all([session.restore(), session.restore()])
    expect(accountApi.me).toHaveBeenCalledTimes(1)
    expect(session.isLoggedIn).toBe(true)
    expect(session.initialized).toBe(true)
  })

  it('treats a rejected session as signed out', async () => {
    accountApi.me.mockRejectedValue(Object.assign(new FetchError('401'), { response: new Response(null, { status: 401 }), status: 401 }))
    const session = useSessionStore()

    await session.restore()
    expect(session.isLoggedIn).toBe(false)
    expect(session.initialized).toBe(true)
  })

  it('keeps the session unknown when the server cannot answer, and asks again later', async () => {
    accountApi.me.mockRejectedValueOnce(new FetchError('Failed to fetch'))
    const session = useSessionStore()

    await session.restore()
    expect(session.isLoggedIn).toBe(false)
    expect(session.initialized).toBe(false)

    accountApi.me.mockResolvedValueOnce(profile)
    await session.restore()
    expect(session.isLoggedIn).toBe(true)
    expect(session.initialized).toBe(true)
  })

  it('registers and uploads the chosen avatar with the new session', async () => {
    const withAvatar = { ...profile, avatarUrl: 'http://localhost:3100/api/avatars/u1/a.png' }
    accountApi.register.mockResolvedValue(profile)
    accountApi.uploadAvatar.mockResolvedValue(withAvatar)
    const session = useSessionStore()
    const avatar = new File(['x'], 'a.png', { type: 'image/png' })

    await expect(session.register({ email: profile.email, password: 'password1', nickname: 'Ada', code: '123456' }, avatar))
      .resolves
      .toBeUndefined()
    expect(accountApi.uploadAvatar).toHaveBeenCalledWith(avatar, 'a.png')
    expect(session.user?.avatarUrl).toBe(withAvatar.avatarUrl)
  })

  it('keeps the new account when only the avatar upload fails', async () => {
    accountApi.register.mockResolvedValue(profile)
    accountApi.uploadAvatar.mockRejectedValue(new Error('Unsupported image type'))
    const session = useSessionStore()

    await expect(session.register({ email: profile.email, password: 'password1', nickname: 'Ada', code: '123456' }, new File(['x'], 'a.png')))
      .resolves
      .toBe('Unsupported image type')
    expect(session.user).toEqual(profile)
  })

  it('clears the local session even when logout fails', async () => {
    accountApi.login.mockResolvedValue(profile)
    accountApi.logout.mockRejectedValue(new Error('offline'))
    const session = useSessionStore()

    await session.login({ email: profile.email, password: 'password1' })
    expect(session.isLoggedIn).toBe(true)
    await expect(session.logout()).rejects.toThrow('offline')
    expect(session.isLoggedIn).toBe(false)
  })

  it('signs in when a pending deletion is restored', async () => {
    accountApi.restoreAccount.mockResolvedValue(profile)
    const session = useSessionStore()

    await session.restoreAccount({ email: profile.email, password: 'password1' })
    expect(accountApi.restoreAccount).toHaveBeenCalledWith({ email: profile.email, password: 'password1' })
    expect(session.user).toEqual(profile)
  })

  it('signs out locally after requesting deletion and returns the purge date', async () => {
    accountApi.login.mockResolvedValue(profile)
    accountApi.requestDeletion.mockResolvedValue({ deletionScheduledAt: '2026-11-01T00:00:00.000Z' })
    const session = useSessionStore()

    await session.login({ email: profile.email, password: 'password1' })
    queryClient.setQueryData(['account', 'exports'], { items: [] })
    await expect(session.requestDeletion('password1')).resolves.toBe('2026-11-01T00:00:00.000Z')
    expect(accountApi.requestDeletion).toHaveBeenCalledWith('password1')
    expect(session.isLoggedIn).toBe(false)
    expect(queryClient.getQueryData(['account', 'exports'])).toBeUndefined()
  })

  it('keeps the session when the deletion request fails', async () => {
    accountApi.login.mockResolvedValue(profile)
    accountApi.requestDeletion.mockRejectedValue(new Error('wrong password'))
    const session = useSessionStore()

    await session.login({ email: profile.email, password: 'password1' })
    await expect(session.requestDeletion('nope')).rejects.toThrow('wrong password')
    expect(session.isLoggedIn).toBe(true)
  })

  it('drops cached server data when the user signs out, but not on profile updates', async () => {
    accountApi.login.mockResolvedValue(profile)
    accountApi.updateProfile.mockResolvedValue({ ...profile, nickname: 'Lovelace' })
    accountApi.logout.mockResolvedValue(undefined)
    const session = useSessionStore()

    await session.login({ email: profile.email, password: 'password1' })
    queryClient.setQueryData(['orders'], ['o1'])
    await session.updateProfile({ nickname: 'Lovelace' })
    expect(queryClient.getQueryData(['orders'])).toEqual(['o1'])

    await session.logout()
    expect(queryClient.getQueryData(['orders'])).toBeUndefined()
  })
})
