import type { MaybeRefOrGetter } from 'vue'
import type { NotificationQuery } from '@/lib/notifications'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { NOTIFICATIONS_KEY, notificationsApi } from '@/lib/notifications'

/** Unread personal notifications and announcements, for the navbar badge. */
export function useUnreadCount() {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'unreadCount'], queryFn: notificationsApi.unreadCount })
}

/** `enabled: false` keeps a list idle (e.g. the bell while its popover is closed). */
export function useNotificationList(query: MaybeRefOrGetter<NotificationQuery>, enabled: MaybeRefOrGetter<boolean> = true) {
  const params = computed(() => toValue(query))
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', params],
    queryFn: () => notificationsApi.list(params.value),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(enabled)),
  })
}

export function useAnnouncementList(query: MaybeRefOrGetter<{ page?: number, pageSize?: number }>, enabled: MaybeRefOrGetter<boolean> = true) {
  const params = computed(() => toValue(query))
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'announcements', params],
    queryFn: () => notificationsApi.announcements(params.value),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(enabled)),
  })
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'preferences'], queryFn: notificationsApi.preferences })
}

/** Read marks, deletions and preference changes; each refreshes every notification query. */
export function useNotificationActions() {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
  return {
    markRead: useMutation({ mutationFn: notificationsApi.markRead, onSettled }),
    markAllRead: useMutation({ mutationFn: notificationsApi.markAllRead, onSettled }),
    remove: useMutation({ mutationFn: notificationsApi.remove, onSettled }),
    markAnnouncementRead: useMutation({ mutationFn: notificationsApi.markAnnouncementRead, onSettled }),
    markAllAnnouncementsRead: useMutation({ mutationFn: notificationsApi.markAllAnnouncementsRead, onSettled }),
    updatePreferences: useMutation({ mutationFn: notificationsApi.updatePreferences, onSettled }),
  }
}
