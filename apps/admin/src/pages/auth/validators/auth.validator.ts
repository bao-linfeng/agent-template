import { z } from 'zod'

import { t } from '@/plugins/i18n'

// Limits mirror the server DTOs (apps/server/src/modules/auth/dto/auth.dto.ts).
// Error messages are functions so they are translated in the locale active at validation time.
export const emailField = z.email({ error: () => t('validation.email') }).max(255)

/** 8-72 characters (bcrypt limit). */
export const newPasswordField = z
  .string()
  .min(8, { error: () => t('validation.passwordMin') })
  .max(72, { error: () => t('validation.passwordMax') })

export const nicknameField = z
  .string()
  .trim()
  .min(2, { error: () => t('validation.nicknameMin') })
  .max(50, { error: () => t('validation.nicknameMax') })

function confirmMatches(value: { password: string, confirmPassword: string }) {
  return value.password === value.confirmPassword
}

const confirmError = { error: () => t('validation.passwordsMismatch'), path: ['confirmPassword'] }

export const loginValidator = z.object({
  email: emailField,
  password: z.string().min(1, { error: () => t('validation.passwordRequired') }).max(72),
})

export const forgotPasswordValidator = z.object({
  email: emailField,
})

export const resetPasswordValidator = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine(confirmMatches, confirmError)

export type LoginValidator = z.infer<typeof loginValidator>
export type ResetPasswordValidator = z.infer<typeof resetPasswordValidator>
