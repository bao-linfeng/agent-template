import { z } from 'zod'

import { newPasswordField } from '@/pages/auth/validators/auth.validator'

export const changePasswordValidator = z
  .object({
    currentPassword: z.string().min(1, { error: 'Please enter your current password.' }).max(72),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine(value => value.newPassword === value.confirmPassword, {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine(value => value.newPassword !== value.currentPassword, {
    error: 'The new password must be different from the current one.',
    path: ['newPassword'],
  })

export type ChangePasswordValidator = z.infer<typeof changePasswordValidator>
