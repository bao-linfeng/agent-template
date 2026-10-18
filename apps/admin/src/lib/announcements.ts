/** Form helpers of the announcement editor (`src/pages/announcements`). */
import dayjs from 'dayjs'

import type { AnnouncementAudience, IAnnouncement, IAnnouncementBody, ICreateAnnouncementBody } from '@/services/api/announcements.api'
import type { AnnouncementLevel } from '@/services/api/notifications.api'

/** What creating does: save a draft, publish now or publish at `publishAt`. */
export type AnnouncementPublishMode = 'draft' | 'now' | 'schedule'

/**
 * `expiresAt` and `publishAt` are values of an `<input type="datetime-local">` (local time), `''` for
 * none. `publishMode` and `publishAt` only apply when creating; edits keep the publication state.
 */
export interface AnnouncementFormValues {
  title: string
  body: string
  level: AnnouncementLevel
  audience: AnnouncementAudience
  expiresAt: string
  publishMode: AnnouncementPublishMode
  publishAt: string
}

const LOCAL_INPUT_FORMAT = 'YYYY-MM-DDTHH:mm'

/** ISO instant → `datetime-local` value in the browser's time zone. */
export function toLocalInput(iso: string | null): string {
  return iso ? dayjs(iso).format(LOCAL_INPUT_FORMAT) : ''
}

/** `datetime-local` value → ISO instant; empty or invalid input means no expiry. */
export function fromLocalInput(value: string): string | null {
  // `YYYY-MM-DDTHH:mm` without an offset parses as local time.
  const date = dayjs(value)
  return value && date.isValid() ? date.toISOString() : null
}

export function toFormValues(announcement?: IAnnouncement): AnnouncementFormValues {
  return {
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    level: announcement?.level ?? 'info',
    audience: announcement?.audience ?? 'all',
    expiresAt: toLocalInput(announcement?.expiresAt ?? null),
    publishMode: 'draft',
    publishAt: '',
  }
}

/** The next full hour as a `datetime-local` value: the suggested publication time. */
export function nextHourInput(now = new Date()): string {
  return toLocalInput(dayjs(now).add(1, 'hour').startOf('hour').toISOString())
}

/**
 * Why a publication time is rejected, mirroring the server's `ANNOUNCEMENT_SCHEDULE_INVALID`:
 * `futureTime` when it is missing or not in the future, `beforeExpiry` when the expiry is not after it.
 * Both arguments are `datetime-local` values.
 */
export function scheduleError(publishAt: string, expiresAt: string, now = new Date()): 'futureTime' | 'beforeExpiry' | null {
  const publish = fromLocalInput(publishAt)
  if (!publish || new Date(publish) <= now)
    return 'futureTime'
  const expiry = fromLocalInput(expiresAt)
  return expiry && new Date(expiry) <= new Date(publish) ? 'beforeExpiry' : null
}

/** Body of a new announcement (trimmed, no expiry field when none is set). */
export function toCreateBody(values: AnnouncementFormValues): IAnnouncementBody {
  const expiresAt = fromLocalInput(values.expiresAt)
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    level: values.level,
    audience: values.audience,
    ...(expiresAt ? { expiresAt } : {}),
  }
}

/** Body of `POST /announcements`: the fields plus what `publishMode` asks for. */
export function toCreateRequest(values: AnnouncementFormValues): ICreateAnnouncementBody {
  const body: ICreateAnnouncementBody = toCreateBody(values)
  if (values.publishMode === 'now')
    body.publish = true
  const publishAt = values.publishMode === 'schedule' ? fromLocalInput(values.publishAt) : null
  if (publishAt)
    body.publishAt = publishAt
  return body
}

/** Only the fields that changed; a cleared expiry is sent as `null`. */
export function announcementChanges(original: IAnnouncement, values: AnnouncementFormValues): Partial<IAnnouncementBody> {
  const next = toCreateBody(values)
  const changes: Partial<IAnnouncementBody> = {}
  if (next.title !== original.title)
    changes.title = next.title
  if (next.body !== original.body)
    changes.body = next.body
  if (next.level !== original.level)
    changes.level = next.level
  if (next.audience !== original.audience)
    changes.audience = next.audience
  // Compared at minute precision, like the input.
  if (values.expiresAt !== toLocalInput(original.expiresAt))
    changes.expiresAt = next.expiresAt ?? null
  return changes
}
