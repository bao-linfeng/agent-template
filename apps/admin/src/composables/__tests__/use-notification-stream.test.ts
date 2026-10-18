import type { EventStreamOptions } from '@repo/utils'

import { FetchError } from '@repo/utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import type { IUserProfile } from '@/services/types/user.type'

import { useNotificationStream } from '@/composables/use-notification-stream'
import { useAuthStore } from '@/stores/auth'

const stream = vi.hoisted(() => ({
  options: undefined as EventStreamOptions | undefined,
  close: vi.fn(),
}))
const queryClient = vi.hoisted(() => ({ invalidateQueries: vi.fn() }))
const apiFetch = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@repo/utils', async importOriginal => ({
  ...await importOriginal<typeof import('@repo/utils')>(),
  connectEventStream: (options: EventStreamOptions) => {
    stream.options = options
    return { close: stream.close }
  },
}))
vi.mock('@tanstack/vue-query', () => ({ useQueryClient: () => queryClient }))
vi.mock('@/lib/query-client', () => ({ queryClient: { removeQueries: vi.fn() } }))
vi.mock('@/lib/api-client', () => ({ apiFetch }))
vi.mock('vue-sonner', () => ({ toast }))
vi.mock('vue-router', () => ({ useRouter: () => router }))

const profile = { id: 'a1', email: 'ada@example.com', nickname: 'Ada', roles: [], permissions: [] } as unknown as IUserProfile

function mount() {
  const scope = effectScope()
  scope.run(() => useNotificationStream())
  return scope
}

describe('useNotificationStream', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stream.options = undefined
    vi.clearAllMocks()
  })

  it('connects while signed in and closes on sign-out and unmount', async () => {
    const auth = useAuthStore()
    const scope = mount()
    expect(stream.options).toBeUndefined()

    auth.setUser(profile)
    await nextTick()
    expect(stream.options).toBeDefined()
    const signal = new AbortController().signal
    await stream.options!.open(signal)
    expect(apiFetch).toHaveBeenCalledWith('/notifications/stream', { responseType: 'stream', retry: 0, signal })

    auth.clear()
    await nextTick()
    expect(stream.close).toHaveBeenCalledTimes(1)

    auth.setUser(profile)
    await nextTick()
    scope.stop()
    expect(stream.close).toHaveBeenCalledTimes(2)
  })

  it('refreshes notification queries and toasts new notifications', async () => {
    useAuthStore().setUser(profile)
    const scope = mount()
    await nextTick()
    const { onEvent } = stream.options!

    onEvent({ event: 'ready', data: '{}' })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] })

    onEvent({
      event: 'notification',
      data: JSON.stringify({ id: 'n1', type: 'security.passwordChanged', params: {}, title: '', body: '', link: '/settings/account' }),
    })
    expect(toast).toHaveBeenCalledWith('Your password was changed', expect.objectContaining({
      action: expect.objectContaining({ label: 'Open' }),
    }))
    toast.mock.calls[0]![1].action.onClick()
    expect(router.push).toHaveBeenCalledWith('/settings/account')
    scope.stop()
  })

  it('refreshes announcements after a delay and stops on a final 401', async () => {
    vi.useFakeTimers()
    try {
      useAuthStore().setUser(profile)
      const scope = mount()
      await nextTick()
      stream.options!.onEvent({ event: 'announcement', data: '{"id":"x"}' })
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(3000)
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1)

      const unauthorized = new FetchError('401')
      Object.assign(unauthorized, { response: new Response(null, { status: 401 }), status: 401 })
      expect(stream.options!.onError!(unauthorized)).toBe(false)
      expect(stream.options!.onError!(new Error('offline'))).toBe(true)
      scope.stop()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
