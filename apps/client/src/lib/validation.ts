import { t } from '@/i18n'

// Limits mirror the server DTOs (apps/server/src/modules/auth/dto/auth.dto.ts). Each check returns a
// message in the current UI language or `undefined`.

const EMAIL = /^[^\s@]+@[^\s@][^\s.@]*(?:\.[^\s.@]+)+$/

export function checkEmail(value: string) {
  const email = value.trim()
  if (!email)
    return t('validation.emailRequired')
  if (!EMAIL.test(email) || email.length > 255)
    return t('validation.emailInvalid')
}

/** 8-72 characters (bcrypt limit). */
export function checkNewPassword(value: string) {
  if (value.length < 8)
    return t('validation.passwordTooShort')
  if (value.length > 72)
    return t('validation.passwordTooLong')
}

export function checkConfirmation(password: string, confirmation: string) {
  if (password !== confirmation)
    return t('validation.passwordMismatch')
}

export function checkNickname(value: string) {
  const nickname = value.trim()
  if (nickname.length < 2)
    return t('validation.nicknameTooShort')
  if (nickname.length > 50)
    return t('validation.nicknameTooLong')
}

/** Formats the server accepts for avatars (it checks the file content). */
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

/** Server default `AVATAR_MAX_BYTES` (2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export function checkAvatar(file: Pick<File, 'type' | 'size'>) {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type))
    return t('validation.avatarType')
  if (file.size > AVATAR_MAX_BYTES)
    return t('validation.avatarSize')
}

/** Keeps only the messages that are set; empty object means valid. */
export function collectErrors<K extends string>(checks: Record<K, string | undefined>): Partial<Record<K, string>> {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message)) as Partial<Record<K, string>>
}

/** Only same-app paths are accepted as `?redirect=` targets (no `//evil.com` or `/\evil.com`). */
export function safeRedirect(redirect: unknown, fallback = '/account'): string {
  return typeof redirect === 'string' && /^\/(?![/\\])/.test(redirect) ? redirect : fallback
}
