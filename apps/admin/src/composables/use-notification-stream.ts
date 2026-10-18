import type { ServerSentEvent } from '@repo/utils'

import { connectEventStream, isUnauthorized } from '@repo/utils'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import { apiFetch } from '@/lib/api-client'
import { isAppLink, notificationText, streamAction } from '@/lib/notifications'
import { t } from '@/plugins/i18n'
import { NOTIFICATIONS_KEY } from '@/services/api/notifications.api'
import { useAuthStore } from '@/stores/auth'

/**
 * Keeps the signed-in admin's notification stream (`GET /notifications/stream`) open and refreshes the
 * notification queries on its events; new notifications are also toasted. Mount it once, in the
 * dashboard layout. The stream goes through `apiFetch`, so an expired session is refreshed when it
 * reconnects; when that fails the admin is signed out and the stream stops.
 */
export function useNotificationStream() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()
  const router = useRouter()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let connection: { close: () => void } | undefined

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
  }

  function handle(event: ServerSentEvent) {
    const action = streamAction(event)
    if (action.kind === 'refresh') {
      refresh()
    }
    else if (action.kind === 'refreshLater') {
      const timer = setTimeout(() => {
        timers.delete(timer)
        refresh()
      }, action.delayMs)
      timers.add(timer)
    }
    else if (action.kind === 'notify') {
      refresh()
      const { notification } = action
      const { title, body } = notificationText(notification)
      const link = notification.link
      toast(title, {
        description: body,
        action: isAppLink(link) ? { label: t('notifications.open'), onClick: () => router.push(link) } : undefined,
      })
    }
  }

  function stop() {
    connection?.close()
    connection = undefined
    timers.forEach(clearTimeout)
    timers.clear()
  }

  function start() {
    connection = connectEventStream({
      open: signal => apiFetch<ReadableStream<Uint8Array>>('/notifications/stream', { responseType: 'stream', retry: 0, signal }),
      onEvent: handle,
      // apiFetch already tried to refresh the session: a 401 here means the admin was signed out.
      onError: error => !isUnauthorized(error),
    })
  }

  watch(() => authStore.isLogin, (isLogin) => {
    stop()
    if (isLogin)
      start()
  }, { immediate: true })

  onScopeDispose(stop)
}
