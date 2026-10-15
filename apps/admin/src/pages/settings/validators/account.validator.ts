import { z } from 'zod'

import { newPasswordField } from '@/pages/auth/validators/auth.validator'
import { t } from '@/plugins/i18n'

export const changePasswordValidator = z
  .object({
    currentPassword: z.string().min(1, { error: () => t('validation.currentPasswordRequired') }).max(72),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine(value => value.newPassword === value.confirmPassword, {
    error: () => t('validation.passwordsMismatch'),
    path: ['confirmPassword'],
  })
  .refine(value => value.newPassword !== value.currentPassword, {
    error: () => t('validation.passwordSameAsCurrent'),
    path: ['newPassword'],
  })

export type ChangePasswordValidator = z.infer<typeof changePasswordValidator>
