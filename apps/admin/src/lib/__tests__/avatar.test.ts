import { describe, expect, it } from 'vitest'

import { AVATAR_MAX_BYTES, initialsOf, validateAvatarFile } from '@/lib/avatar'

describe('validateAvatarFile', () => {
  it('accepts the image formats the server accepts', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
      expect(validateAvatarFile({ type, size: 1024 })).toBeNull()
  })

  it('rejects other types and oversized files', () => {
    expect(validateAvatarFile({ type: 'image/svg+xml', size: 10 })).toMatch(/PNG, JPEG, GIF or WebP/)
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toMatch(/2 MB/)
  })
})

describe('initialsOf', () => {
  it('uses the first letters of up to two words', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL')
    expect(initialsOf('grace')).toBe('GR')
    expect(initialsOf('张三')).toBe('张三')
    expect(initialsOf('  ')).toBe('?')
    expect(initialsOf(undefined)).toBe('?')
  })
})
