// Limits mirror the server DTOs (apps/server/src/modules/auth/dto/auth.dto.ts). Each check returns an
// error message or `undefined`.

const EMAIL = /^[^\s@]+@[^\s@][^\s.@]*(?:\.[^\s.@]+)+$/

export function checkEmail(value: string) {
  const email = value.trim()
  if (!email)
    return 'Please enter your email.'
  if (!EMAIL.test(email) || email.length > 255)
    return 'Please enter a valid email address.'
}

/** 8-72 characters (bcrypt limit). */
export function checkNewPassword(value: string) {
  if (value.length < 8)
    return 'Password must be at least 8 characters.'
  if (value.length > 72)
    return 'Password must not be longer than 72 characters.'
}

export function checkConfirmation(password: string, confirmation: string) {
  if (password !== confirmation)
    return 'Passwords do not match.'
}

export function checkNickname(value: string) {
  const nickname = value.trim()
  if (nickname.length < 2)
    return 'Nickname must be at least 2 characters.'
  if (nickname.length > 50)
    return 'Nickname must not be longer than 50 characters.'
}

/** Formats the server accepts for avatars (it checks the file content). */
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

/** Server default `AVATAR_MAX_BYTES` (2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export function checkAvatar(file: Pick<File, 'type' | 'size'>) {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type))
    return 'Please choose a PNG, JPEG, GIF or WebP image.'
  if (file.size > AVATAR_MAX_BYTES)
    return 'The image must be smaller than 2 MB.'
}

/** Keeps only the messages that are set; empty object means valid. */
export function collectErrors<K extends string>(checks: Record<K, string | undefined>): Partial<Record<K, string>> {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message)) as Partial<Record<K, string>>
}

/** Only same-app paths are accepted as `?redirect=` targets (no `//evil.com` or `/\evil.com`). */
export function safeRedirect(redirect: unknown, fallback = '/account'): string {
  return typeof redirect === 'string' && /^\/(?![/\\])/.test(redirect) ? redirect : fallback
}
