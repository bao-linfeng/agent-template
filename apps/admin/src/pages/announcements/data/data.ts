import type { AnnouncementPublishMode } from '@/lib/announcements'
import type { AnnouncementAudience, AnnouncementStatus } from '@/services/api/announcements.api'
import type { AnnouncementLevel } from '@/services/api/notifications.api'

/** `label` values are vue-i18n message keys. */
export const announcementStatuses = [
  { value: 'draft', label: 'announcements.statuses.draft', variant: 'outline' },
  { value: 'scheduled', label: 'announcements.statuses.scheduled', variant: 'secondary' },
  { value: 'published', label: 'announcements.statuses.published', variant: 'default' },
  { value: 'expired', label: 'announcements.statuses.expired', variant: 'secondary' },
] as const satisfies { value: AnnouncementStatus, label: string, variant: string }[]

export const announcementAudiences = [
  { value: 'all', label: 'announcements.audiences.all' },
  { value: 'user', label: 'announcements.audiences.user' },
  { value: 'admin', label: 'announcements.audiences.admin' },
] as const satisfies { value: AnnouncementAudience, label: string }[]

export const announcementPublishModes = [
  { value: 'draft', label: 'announcements.publishModes.draft' },
  { value: 'now', label: 'announcements.publishModes.now' },
  { value: 'schedule', label: 'announcements.publishModes.schedule' },
] as const satisfies { value: AnnouncementPublishMode, label: string }[]

export const announcementLevels = [
  { value: 'info', label: 'notifications.levels.info', variant: 'secondary' },
  { value: 'warning', label: 'notifications.levels.warning', variant: 'default' },
  { value: 'critical', label: 'notifications.levels.critical', variant: 'destructive' },
] as const satisfies { value: AnnouncementLevel, label: string, variant: string }[]
