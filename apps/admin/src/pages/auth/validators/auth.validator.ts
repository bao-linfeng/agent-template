import { z } from 'zod'

// Limits mirror the server DTOs (apps/server/src/modules/auth/dto/auth.dto.ts).
export const emailField = z.email({ error: 'Please enter a valid email address.' }).max(255)

/** 8-72 characters (bcrypt limit). */
export const newPasswordField = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password must not be longer than 72 characters.' })

export const nicknameField = z
  .string()
  .trim()
  .min(2, { error: 'Nickname must be at least 2 characters.' })
  .max(50, { error: 'Nickname must not be longer than 50 characters.' })

function confirmMatches(value: { password: string, confirmPassword: string }) {
  return value.password === value.confirmPassword
}

const confirmError = { error: 'Passwords do not match.', path: ['confirmPassword'] }

export const loginValidator = z.object({
  email: emailField,
  password: z.string().min(1, { error: 'Please enter your password.' }).max(72),
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
