import { connectEventStream, isUnauthorized } from '@repo/utils'
import { useQueryClient } from '@tanstack/vue-query'
import { onScopeDispose, watch } from 'vue'
import { NOTIFICATIONS_KEY, notificationsApi, streamRefreshDelay } from '@/lib/notifications'
import { useSessionStore } from '@/stores/session'

/**
 * Keeps the signed-in user's notification stream (`GET /notifications/stream`) open and refreshes the
 * notification queries (badge and lists) on its events. Mounted once in `App.vue`. The stream goes
 * through the API client, so an expired session is refreshed when it reconnects; when that fails the
 * session store signs the user out and the stream stops.
 */
export function useNotificationStream() {
  const session = useSessionStore()
  const queryClient = useQueryClient()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let connection: { close: () => void } | undefined

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
  }

  function stop() {
    connection?.close()
    connection = undefined
    timers.forEach(clearTimeout)
    timers.clear()
  }

  function start() {
    connection = connectEventStream({
      open: notificationsApi.stream,
      onEvent: (event) => {
        const delay = streamRefreshDelay(event)
        if (delay === 0) {
          refresh()
        }
        else if (delay !== null) {
          const timer = setTimeout(() => {
            timers.delete(timer)
            refresh()
          }, delay)
          timers.add(timer)
        }
      },
      // The API client already tried to refresh the session: a 401 here means the user was signed out.
      onError: error => !isUnauthorized(error),
    })
  }

  // Keyed by user id: switching accounts reconnects with the new session.
  watch(() => session.user?.id, (id) => {
    stop()
    if (id)
      start()
  }, { immediate: true })

  onScopeDispose(stop)
}
