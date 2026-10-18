/** Form helpers of the announcement editor (`src/pages/announcements`). */
import dayjs from 'dayjs'

import type { AnnouncementAudience, IAnnouncement, IAnnouncementBody } from '@/services/api/announcements.api'
import type { AnnouncementLevel } from '@/services/api/notifications.api'

/** `expiresAt` is the value of an `<input type="datetime-local">` (local time), `''` for none. */
export interface AnnouncementFormValues {
  title: string
  body: string
  level: AnnouncementLevel
  audience: AnnouncementAudience
  expiresAt: string
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
  }
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
