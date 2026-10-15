import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IUserProfile } from '@/services/types/user.type'

import { useAuthStore } from '../auth'
import { useSidebarConfigStore } from '../sidebar-config'
import { useThemeStore } from '../theme'

const fetchMe = vi.hoisted(() => vi.fn())
vi.mock('@/services/api/me.api', () => ({ fetchMe }))

const profile: IUserProfile = {
  id: 'u1',
  email: 'ada@example.com',
  nickname: 'Ada',
  avatarUrl: null,
  status: 'active',
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: ['admin'],
  permissions: ['user:read', 'embedding-model:manage'],
}

describe('stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMe.mockReset()
  })

  it('tracks the signed-in user and its permissions', () => {
    const authStore = useAuthStore()

    expect(authStore.isLogin).toBe(false)
    expect(authStore.can('user:read')).toBe(false)

    authStore.setUser(profile)

    expect(authStore.isLogin).toBe(true)
    expect(authStore.initialized).toBe(true)
    expect(authStore.can('user:read')).toBe(true)
    expect(authStore.can('embedding-model:read')).toBe(true)
    expect(authStore.can('user:update')).toBe(false)

    authStore.clear()

    expect(authStore.isLogin).toBe(false)
    expect(authStore.user).toBeNull()
  })

  it('restores the session once, sharing concurrent calls', async () => {
    fetchMe.mockResolvedValue(profile)
    const authStore = useAuthStore()

    await Promise.all([authStore.restore(), authStore.restore()])

    expect(fetchMe).toHaveBeenCalledTimes(1)
    expect(authStore.user).toEqual(profile)
  })

  it('treats a failed restore as signed out', async () => {
    fetchMe.mockRejectedValue(new Error('401'))
    const authStore = useAuthStore()

    await authStore.restore()

    expect(authStore.isLogin).toBe(false)
    expect(authStore.initialized).toBe(true)
  })

  it('updates theme preferences', () => {
    const themeStore = useThemeStore()

    themeStore.setTheme('blue')
    themeStore.setRadius(0.75)
    themeStore.setContentLayout('full')

    expect(themeStore.theme).toBe('blue')
    expect(themeStore.radius).toBe(0.75)
    expect(themeStore.contentLayout).toBe('full')
  })

  it('updates sidebar navigation mode', () => {
    const sidebarConfigStore = useSidebarConfigStore()

    expect(sidebarConfigStore.navigationMode).toBe('collapsible')

    sidebarConfigStore.setNavigationMode('vercel')

    expect(sidebarConfigStore.navigationMode).toBe('vercel')
  })
})
