import { z } from 'zod'

import { fromLocalInput, scheduleError } from '@/lib/announcements'
import { t } from '@/plugins/i18n'

// Limits mirror the server DTO (apps/server/src/modules/notifications/dto/announcement.dto.ts).
export const announcementValidator = z.object({
  title: z.string().trim().min(1, { error: () => t('validation.required') }).max(200, { error: () => t('validation.textMax', { max: 200 }) }),
  body: z.string().trim().min(1, { error: () => t('validation.required') }).max(5000, { error: () => t('validation.textMax', { max: 5000 }) }),
  level: z.enum(['info', 'warning', 'critical']),
  audience: z.enum(['all', 'user', 'admin']),
  expiresAt: z.string().refine((value) => {
    const iso = fromLocalInput(value)
    return iso === null || new Date(iso) > new Date()
  }, { error: () => t('validation.futureTime') }),
  publishMode: z.enum(['draft', 'now', 'schedule']),
  publishAt: z.string(),
}).superRefine((values, ctx) => {
  if (values.publishMode !== 'schedule')
    return
  const error = scheduleError(values.publishAt, values.expiresAt)
  if (error === 'futureTime')
    ctx.addIssue({ code: 'custom', path: ['publishAt'], message: t('validation.futureTime') })
  else if (error === 'beforeExpiry')
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: t('validation.expiryAfterPublish') })
})
