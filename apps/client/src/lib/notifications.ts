/**
 * Notifications of the signed-in client user (`/notifications`): personal notifications, announcements,
 * channel preferences and the event stream. Rows carry a type code and parameters, translated under
 * `notifications.types.<type>.{title,body}`; unknown types show the English text the server rendered.
 */
import type { ServerSentEvent } from '@repo/utils'
import type { Page } from './account'
import { i18n, t } from '@/i18n'
import { api } from './api'

export type NotificationChannel = 'inApp' | 'email'
export type AnnouncementLevel = 'info' | 'warning' | 'critical'

export interface AppNotification {
  id: string
  type: string
  category: string | null
  params: Record<string, unknown>
  /** English fallback for types this app does not translate. */
  title: string
  body: string
  /** App route to open, e.g. `/account`. */
  link: string | null
  readAt: string | null
  createdAt: string
}

export interface Announcement {
  id: string
  title: string
  /** Plain text from administrators: render as text, never as HTML. */
  body: string
  level: AnnouncementLevel
  publishedAt: string
  expiresAt: string | null
  readAt: string | null
}

export interface UnreadCount {
  notifications: number
  announcements: number
  total: number
}

export interface NotificationPreference {
  category: string
  mandatory: boolean
  description: string
  channels: Partial<Record<NotificationChannel, boolean>>
}

export interface NotificationQuery {
  page?: number
  pageSize?: number
  unread?: boolean
}

/** Every notification query lives below this key; the event stream invalidates it as a whole. */
export const NOTIFICATIONS_KEY = ['notifications'] as const

function compact<T extends object>(query: T): Partial<T> {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>
}

export const notificationsApi = {
  list: (query: NotificationQuery = {}) => api<Page<AppNotification>>('/notifications', { query: compact(query) }),
  unreadCount: () => api<UnreadCount>('/notifications/unread-count'),
  markRead: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
  remove: (id: string) => api<void>(`/notifications/${id}`, { method: 'DELETE' }),
  announcements: (query: { page?: number, pageSize?: number } = {}) =>
    api<Page<Announcement>>('/notifications/announcements', { query: compact(query) }),
  markAnnouncementRead: (id: string) => api<void>(`/notifications/announcements/${id}/read`, { method: 'POST' }),
  markAllAnnouncementsRead: () => api<{ updated: number }>('/notifications/announcements/read-all', { method: 'POST' }),
  preferences: () => api<NotificationPreference[]>('/notifications/preferences'),
  /** `{ <category>: { <channel>: boolean } }`; 400 `NOTIFICATION_CATEGORY_MANDATORY` for mandatory ones. */
  updatePreferences: (preferences: Record<string, Partial<Record<NotificationChannel, boolean>>>) =>
    api<NotificationPreference[]>('/notifications/preferences', { method: 'PATCH', body: { preferences } }),
  /** The `text/event-stream` body; passing `signal` also turns off the request timeout. */
  stream: (signal: AbortSignal) =>
    api<ReadableStream<Uint8Array>>('/notifications/stream', { responseType: 'stream', retry: 0, signal }),
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(i18n.global.locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Params ending in `At` hold ISO dates (e.g. `expiresAt`); they are shown in the current language. */
export function formatNotificationParams(params: Record<string, unknown>): Record<string, string | number> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => {
    if (key.endsWith('At') && typeof value === 'string' && !Number.isNaN(Date.parse(value)))
      return [key, formatDate(value)]
    return [key, typeof value === 'number' ? value : String(value ?? '')]
  }))
}

export function notificationText(notification: Pick<AppNotification, 'type' | 'params' | 'title' | 'body'>): { title: string, body: string } {
  const key = `notifications.types.${notification.type}`
  if (!i18n.global.te(`${key}.title`))
    return { title: notification.title, body: notification.body }
  const params = formatNotificationParams(notification.params)
  return {
    title: t(`${key}.title`, params),
    body: i18n.global.te(`${key}.body`) ? t(`${key}.body`, params) : notification.body,
  }
}

/** Translated category name; unknown categories fall back to `fallback` (server description) or the key. */
export function categoryLabel(category: string, fallback?: string): string {
  const key = `notifications.categories.${category}`
  return i18n.global.te(key) ? t(key) : fallback || category
}

/** Only routes of this app are followed. */
export function isAppLink(link: string | null): link is string {
  return typeof link === 'string' && /^\/(?![/\\])/.test(link)
}

/**
 * What the app does with a stream event: refresh the notification queries (`ready`, `sync`, a new
 * `notification`), or refresh after a random delay for `announcement`, which reaches every user at once.
 */
export function streamRefreshDelay(event: ServerSentEvent, random = Math.random): number | null {
  switch (event.event) {
    case 'ready':
    case 'sync':
    case 'notification':
      return 0
    case 'announcement':
      return Math.round(random() * 3000)
    default:
      return null
  }
}
