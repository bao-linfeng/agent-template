/**
 * Display helpers for server notifications: rows carry a type code and parameters, translated here
 * under `notifications.types.<type>.{title,body}` (like `apiErrors.<code>`); types this console does not
 * know yet show the English text the server rendered.
 */
import type { ServerSentEvent } from '@repo/utils'

import dayjs from 'dayjs'

import type { INotification } from '@/services/api/notifications.api'

import { i18n, t } from '@/plugins/i18n'

/** Params ending in `At` hold ISO dates (e.g. `expiresAt`); they are shown in the current language. */
export function formatNotificationParams(params: Record<string, unknown>): Record<string, string | number> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => {
    if (key.endsWith('At') && typeof value === 'string' && dayjs(value).isValid())
      return [key, dayjs(value).format('YYYY-MM-DD HH:mm')]
    if (key === 'change' && typeof value === 'string' && i18n.global.te(`notifications.changes.${value}`))
      return [key, t(`notifications.changes.${value}`)]
    return [key, typeof value === 'number' ? value : String(value ?? '')]
  }))
}

export function notificationText(notification: Pick<INotification, 'type' | 'params' | 'title' | 'body'>): { title: string, body: string } {
  const key = `notifications.types.${notification.type}`
  if (!i18n.global.te(`${key}.title`))
    return { title: notification.title, body: notification.body }
  const params = formatNotificationParams(notification.params)
  return {
    title: t(`${key}.title`, params),
    body: i18n.global.te(`${key}.body`) ? t(`${key}.body`, params) : notification.body,
  }
}

/** Translated category name; unknown categories fall back to `fallback` (the server description) or the key. */
export function categoryLabel(category: string, fallback?: string): string {
  const key = `notifications.categories.${category}`
  return i18n.global.te(key) ? t(key) : fallback || category
}

/** Only console routes are followed; anything else stays a plain notification. */
export function isAppLink(link: string | null): link is string {
  return typeof link === 'string' && /^\/(?![/\\])/.test(link)
}

/** What the console does with an event of `GET /notifications/stream`. */
export type StreamAction
  = | { kind: 'refresh' }
    /** Announcements reach every admin at once: refresh after a random delay to spread the requests. */
    | { kind: 'refreshLater', delayMs: number }
    | { kind: 'notify', notification: INotification }
    | { kind: 'ignore' }

export function streamAction(event: ServerSentEvent, random = Math.random): StreamAction {
  switch (event.event) {
    case 'ready':
    case 'sync':
      return { kind: 'refresh' }
    case 'announcement':
      return { kind: 'refreshLater', delayMs: Math.round(random() * 3000) }
    case 'notification': {
      try {
        return { kind: 'notify', notification: JSON.parse(event.data) as INotification }
      }
      catch {
        return { kind: 'refresh' }
      }
    }
    default:
      return { kind: 'ignore' }
  }
}
