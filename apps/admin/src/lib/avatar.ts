import { t } from '@/plugins/i18n'

/** Formats the server accepts (it checks the file content, not the name). */
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

/** Server default `AVATAR_MAX_BYTES` (2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** Returns an error message, or `null` when the file can be uploaded. */
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>, maxBytes = AVATAR_MAX_BYTES): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type))
    return t('validation.avatarType')
  if (file.size > maxBytes)
    return t('validation.avatarSize', { size: Math.round(maxBytes / 1024 / 1024) })
  return null
}

/** Up to two letters for avatar fallbacks. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2)
    return `${[...words[0]!][0]}${[...words[1]!][0]}`.toUpperCase()
  return [...(words[0] ?? '?')].slice(0, 2).join('').toUpperCase()
}
