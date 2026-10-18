import type { EventStreamOptions } from '@repo/utils'
import type { UserProfile } from '@/lib/account'
import { FetchError } from '@repo/utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useNotificationStream } from '../useNotificationStream'

const stream = vi.hoisted(() => ({
  options: undefined as EventStreamOptions | undefined,
  close: vi.fn(),
}))
const queryClient = vi.hoisted(() => ({ invalidateQueries: vi.fn() }))

vi.mock('@repo/utils', async importOriginal => ({
  ...await importOriginal<typeof import('@repo/utils')>(),
  connectEventStream: (options: EventStreamOptions) => {
    stream.options = options
    return { close: stream.close }
  },
}))
vi.mock('@tanstack/vue-query', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/vue-query')>(),
  useQueryClient: () => queryClient,
}))
vi.mock('@/lib/account', () => ({ accountApi: {} }))

function profile(id: string): UserProfile {
  return { id, email: `${id}@example.com`, nickname: id, avatarUrl: null, status: 'active', lastLoginAt: null, deletionScheduledAt: null, createdAt: '' }
}

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

  it('connects while signed in and reconnects for another account', async () => {
    const session = useSessionStore()
    const scope = mount()
    expect(stream.options).toBeUndefined()

    session.user = profile('u1')
    await nextTick()
    expect(stream.options).toBeDefined()

    session.user = profile('u2')
    await nextTick()
    expect(stream.close).toHaveBeenCalledTimes(1)

    session.user = null
    await nextTick()
    expect(stream.close).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('refreshes notification queries on events and stops on a final 401', async () => {
    vi.useFakeTimers()
    try {
      useSessionStore().user = profile('u1')
      const scope = mount()
      await nextTick()
      const { onEvent, onError } = stream.options!

      onEvent({ event: 'sync', data: '{"reason":"read"}' })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] })

      onEvent({ event: 'announcement', data: '{"id":"a1"}' })
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(3000)
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2)

      const unauthorized = Object.assign(new FetchError('401'), { response: new Response(null, { status: 401 }), status: 401 })
      expect(onError!(unauthorized)).toBe(false)
      expect(onError!(new Error('offline'))).toBe(true)
      scope.stop()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
