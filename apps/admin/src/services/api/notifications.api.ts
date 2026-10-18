import type { MaybeRefOrGetter } from 'vue'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

import { apiFetch } from '@/lib/api-client'

import type { IPaginated } from '../types/response.type'

import { compactQuery } from './admin-users.api'

export type NotificationChannel = 'inApp' | 'email'
export type AnnouncementLevel = 'info' | 'warning' | 'critical'

/**
 * A personal notification of the signed-in admin (`/v1/admin/notifications`). Translate it by `type`
 * (`notifications.types.<type>`, see `src/lib/notifications.ts`); `title`/`body` are the server's English
 * fallback for types this console does not know yet.
 */
export interface INotification {
  id: string
  type: string
  /** Null for types the server release does not know. */
  category: string | null
  params: Record<string, unknown>
  title: string
  body: string
  /** Console route to open, e.g. `/settings/account`. */
  link: string | null
  readAt: string | null
  createdAt: string
}

/** An announcement visible to admins, with this admin's read mark. */
export interface IInboxAnnouncement {
  id: string
  title: string
  /** Plain text: render as text, never as HTML. */
  body: string
  level: AnnouncementLevel
  publishedAt: string
  expiresAt: string | null
  readAt: string | null
}

export interface IUnreadCount {
  notifications: number
  announcements: number
  total: number
}

export interface INotificationPreference {
  category: string
  /** Always delivered; its switches are shown but locked. */
  mandatory: boolean
  /** Server description, used when the console has no translation for the category. */
  description: string
  /** Channels the category uses for admins, with their current switch. */
  channels: Partial<Record<NotificationChannel, boolean>>
}

export interface IListNotificationsQuery {
  page?: number
  pageSize?: number
  unread?: boolean
  category?: string
}

/** `{ <category>: { <channel>: boolean } }`; omitted ones stay unchanged. */
export type NotificationPreferenceChanges = Record<string, Partial<Record<NotificationChannel, boolean>>>

/** Every notification query lives below this key; the event stream invalidates it as a whole. */
export const NOTIFICATIONS_KEY = ['notifications'] as const

// Transport layer (own data, no permission needed)
export function fetchNotifications(query: IListNotificationsQuery = {}) {
  return apiFetch<IPaginated<INotification>>('/notifications', { method: 'get', query: compactQuery(query) })
}

export function fetchUnreadCount() {
  return apiFetch<IUnreadCount>('/notifications/unread-count', { method: 'get' })
}

export function markNotificationRead(id: string) {
  return apiFetch<void>(`/notifications/${id}/read`, { method: 'post' })
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>('/notifications/read-all', { method: 'post' })
}

export function deleteNotification(id: string) {
  return apiFetch<void>(`/notifications/${id}`, { method: 'delete' })
}

export function fetchNotificationPreferences() {
  return apiFetch<INotificationPreference[]>('/notifications/preferences', { method: 'get' })
}

/** 400 `NOTIFICATION_CATEGORY_MANDATORY` / `NOTIFICATION_CATEGORY_UNKNOWN` / `NOTIFICATION_PREFERENCE_INVALID`. */
export function updateNotificationPreferences(preferences: NotificationPreferenceChanges) {
  return apiFetch<INotificationPreference[]>('/notifications/preferences', { method: 'patch', body: { preferences } })
}

export function fetchInboxAnnouncements(query: { page?: number, pageSize?: number } = {}) {
  return apiFetch<IPaginated<IInboxAnnouncement>>('/notifications/announcements', { method: 'get', query: compactQuery(query) })
}

export function markAnnouncementRead(id: string) {
  return apiFetch<void>(`/notifications/announcements/${id}/read`, { method: 'post' })
}

export function markAllAnnouncementsRead() {
  return apiFetch<{ updated: number }>('/notifications/announcements/read-all', { method: 'post' })
}

// Query/mutation hooks
/** `enabled: false` keeps a list idle (e.g. the bell while its popover is closed). */
export function useNotificationsQuery(query: MaybeRefOrGetter<IListNotificationsQuery>, enabled: MaybeRefOrGetter<boolean> = true) {
  const params = computed(() => compactQuery(toValue(query)))
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', params],
    queryFn: () => fetchNotifications(params.value),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(enabled)),
  })
}

export function useUnreadCountQuery() {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'unreadCount'], queryFn: fetchUnreadCount })
}

export function useInboxAnnouncementsQuery(query: MaybeRefOrGetter<{ page?: number, pageSize?: number }>, enabled: MaybeRefOrGetter<boolean> = true) {
  const params = computed(() => compactQuery(toValue(query)))
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'announcements', params],
    queryFn: () => fetchInboxAnnouncements(params.value),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(enabled)),
  })
}

export function useNotificationPreferencesQuery() {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'preferences'], queryFn: fetchNotificationPreferences })
}

/** Read marks, deletions and preference changes refresh every notification query (lists and badge). */
function useNotificationMutation<TVariables, TData>(key: string, mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [key],
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

export function useMarkNotificationReadMutation() {
  return useNotificationMutation('markNotificationRead', markNotificationRead)
}

export function useMarkAllNotificationsReadMutation() {
  return useNotificationMutation('markAllNotificationsRead', markAllNotificationsRead)
}

export function useDeleteNotificationMutation() {
  return useNotificationMutation('deleteNotification', deleteNotification)
}

export function useMarkAnnouncementReadMutation() {
  return useNotificationMutation('markAnnouncementRead', markAnnouncementRead)
}

export function useMarkAllAnnouncementsReadMutation() {
  return useNotificationMutation('markAllAnnouncementsRead', markAllAnnouncementsRead)
}

export function useUpdateNotificationPreferencesMutation() {
  return useNotificationMutation('updateNotificationPreferences', updateNotificationPreferences)
}
