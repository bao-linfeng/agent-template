import { z } from 'zod'

import { fromLocalInput } from '@/lib/announcements'
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
})
