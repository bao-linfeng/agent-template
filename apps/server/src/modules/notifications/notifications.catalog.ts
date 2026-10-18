import { z } from 'zod'
import type { Realm } from '../auth/realms.js'

/** Delivery channels. A new channel (push, SMS, ...) is added here and handled in `NotificationsService.notify`. */
export const NOTIFICATION_CHANNELS = ['inApp', 'email'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export interface NotificationCategoryDefinition {
  /** Always delivered on every channel of its types; preferences cannot turn it off. */
  mandatory: boolean
  /** Shown next to the switch when the client has no translation (`notifications.categories.<key>`). */
  description: string
}

/**
 * Groups of notification types that users switch per channel (`/notifications/preferences`). Keys are
 * stable API (stored in `*_notification_preferences`, translated by both apps): add new keys instead of
 * renaming.
 */
export const NOTIFICATION_CATEGORIES = {
  security: {
    mandatory: true,
    description: 'Password and two-factor authentication changes',
  },
  account: {
    mandatory: false,
    description: 'Data exports and account deletion',
  },
  knowledgeBase: {
    mandatory: false,
    description: 'Results of knowledge base document processing',
  },
} as const satisfies Record<string, NotificationCategoryDefinition>

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES

export interface NotificationTypeDefinition<
  P extends z.ZodType = z.ZodType,
  R extends readonly Realm[] = readonly Realm[],
  C extends readonly NotificationChannel[] = readonly NotificationChannel[],
> {
  category: NotificationCategory
  /** Realms whose accounts may receive it; `notify` only accepts these. */
  realms: R
  /** Channels it is sent on (subject to preferences); with `email`, `notify` requires the rendered mail. */
  channels: C
  /** Validates the parameters stored with each notification (plain JSON: ids, ISO dates, short strings). */
  params: P
  /** English fallback with `{name}` placeholders filled from params; clients translate `notifications.types.<type>`. */
  title: string
  body: string
  /** App route the notification opens, per realm (e.g. `/account`). */
  link?: Partial<Record<R[number], string>>
}

function notificationType<
  P extends z.ZodType,
  const R extends readonly Realm[],
  const C extends readonly NotificationChannel[],
>(
  definition: NotificationTypeDefinition<P, R, C>,
): NotificationTypeDefinition<P, R, C> {
  return definition
}

const isoDate = z.iso.datetime({ offset: true })

/**
 * Every notification type. To add one:
 *   1. declare it here (category, realms, channels, params schema, English title/body, link),
 *   2. call `NotificationsService.notify({ realm, recipientId, type, params, mail? })` after the change it
 *      reports has been committed (`mail` is required, and typed, when the type has the `email` channel),
 *   3. translate `notifications.types.<type>.title|body` in the app(s) of its realms.
 * Keys and params are stable API: stored rows keep them, so add a new type instead of renaming one or
 * changing its params incompatibly.
 */
export const NOTIFICATION_TYPES = {
  'security.passwordChanged': notificationType({
    category: 'security',
    realms: ['user', 'admin'],
    channels: ['inApp', 'email'],
    params: z.object({}),
    title: 'Your password was changed',
    body: 'Other devices were signed out. If this was not you, reset your password right away.',
    link: { user: '/account', admin: '/settings/account' },
  }),
  'security.twoFactorChanged': notificationType({
    category: 'security',
    realms: ['admin'],
    channels: ['inApp', 'email'],
    params: z.object({ change: z.enum(['enabled', 'disabled', 'reset']) }),
    title: 'Two-factor authentication changed',
    body: 'Two-factor authentication of your account was {change}. If this was not you, contact an administrator.',
    link: { admin: '/settings/account' },
  }),
  'account.deletionCancelled': notificationType({
    category: 'account',
    realms: ['user'],
    channels: ['inApp', 'email'],
    params: z.object({}),
    title: 'Account deletion cancelled',
    body: 'Your account has been restored and will not be deleted.',
    link: { user: '/account' },
  }),
  'account.exportReady': notificationType({
    category: 'account',
    realms: ['user'],
    channels: ['inApp', 'email'],
    params: z.object({ exportId: z.uuid(), expiresAt: isoDate }),
    title: 'Your data export is ready',
    body: 'Download it before {expiresAt}.',
    link: { user: '/account' },
  }),
  'knowledgeBase.documentReady': notificationType({
    category: 'knowledgeBase',
    realms: ['user'],
    channels: ['inApp'],
    params: z.object({
      knowledgeBaseId: z.uuid(),
      documentId: z.uuid(),
      title: z.string().max(500),
      chunkCount: z.number().int().min(0),
    }),
    title: 'Document ready',
    body: '"{title}" was indexed into {chunkCount} chunks and can be searched now.',
  }),
  'knowledgeBase.documentFailed': notificationType({
    category: 'knowledgeBase',
    realms: ['user'],
    channels: ['inApp'],
    params: z.object({
      knowledgeBaseId: z.uuid(),
      documentId: z.uuid(),
      title: z.string().max(500),
    }),
    title: 'Document processing failed',
    body: '"{title}" could not be indexed. Check the file and upload it again.',
  }),
} as const

export type NotificationType = keyof typeof NOTIFICATION_TYPES
type TypeDefinition<T extends NotificationType> = (typeof NOTIFICATION_TYPES)[T]
export type NotificationParams<T extends NotificationType> = z.input<
  TypeDefinition<T>['params']
>
export type NotificationRealm<T extends NotificationType> =
  TypeDefinition<T>['realms'][number]
/** True when the type is sent by email, so `notify` needs the rendered mail. */
export type HasEmail<T extends NotificationType> =
  'email' extends TypeDefinition<T>['channels'][number] ? true : false

export const NOTIFICATION_TYPE_KEYS = Object.keys(
  NOTIFICATION_TYPES,
) as NotificationType[]

const definitions = NOTIFICATION_TYPES as Record<
  NotificationType,
  NotificationTypeDefinition
>

export function isNotificationType(type: string): type is NotificationType {
  return Object.hasOwn(NOTIFICATION_TYPES, type)
}

export function notificationTypeDefinition(
  type: NotificationType,
): NotificationTypeDefinition {
  return definitions[type]
}

export function isNotificationCategory(
  category: string,
): category is NotificationCategory {
  return Object.hasOwn(NOTIFICATION_CATEGORIES, category)
}

/** Known types of a category (never empty: every category has a type). */
export function typesOf(category: NotificationCategory): NotificationType[] {
  return NOTIFICATION_TYPE_KEYS.filter(
    (type) => definitions[type].category === category,
  )
}

/** Fills `{name}` placeholders; unknown names stay as they are. */
export function renderTemplate(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    if (value === undefined || value === null) {
      return match
    }
    return typeof value === 'string' ? value : JSON.stringify(value)
  })
}

export interface RealmCategory {
  category: NotificationCategory
  mandatory: boolean
  description: string
  /** Channels used by the category's types in this realm, in `NOTIFICATION_CHANNELS` order. */
  channels: NotificationChannel[]
}

/** Categories with at least one type for `realm`, i.e. what its accounts can configure. */
export function categoriesFor(realm: Realm): RealmCategory[] {
  const result: RealmCategory[] = []
  for (const [category, definition] of Object.entries(
    NOTIFICATION_CATEGORIES,
  ) as [NotificationCategory, NotificationCategoryDefinition][]) {
    const used = new Set<NotificationChannel>()
    for (const type of NOTIFICATION_TYPE_KEYS) {
      const typeDefinition = definitions[type]
      if (
        typeDefinition.category === category &&
        typeDefinition.realms.includes(realm)
      ) {
        typeDefinition.channels.forEach((channel) => used.add(channel))
      }
    }
    if (used.size > 0) {
      result.push({
        category,
        mandatory: definition.mandatory,
        description: definition.description,
        channels: NOTIFICATION_CHANNELS.filter((channel) => used.has(channel)),
      })
    }
  }
  return result
}
