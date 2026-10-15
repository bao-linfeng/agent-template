import { describe, expect, it } from 'vitest'
import {
  AVATAR_MAX_BYTES,
  checkAvatar,
  checkCode,
  checkConfirmation,
  checkEmail,
  checkNewPassword,
  checkNickname,
  collectErrors,
  safeRedirect,
} from '../validation'

describe('form checks', () => {
  it('validates emails', () => {
    expect(checkEmail(' ada@example.com ')).toBeUndefined()
    expect(checkEmail('')).toMatch(/enter your email/)
    expect(checkEmail('ada@example')).toMatch(/valid email/)
    expect(checkEmail('ada example.com')).toMatch(/valid email/)
  })

  it('validates passwords and nicknames like the server', () => {
    expect(checkNewPassword('1234567')).toMatch(/at least 8/)
    expect(checkNewPassword('12345678')).toBeUndefined()
    expect(checkNewPassword('x'.repeat(73))).toMatch(/72/)
    expect(checkConfirmation('a', 'b')).toMatch(/do not match/)
    expect(checkNickname(' a ')).toMatch(/at least 2/)
    expect(checkNickname('Ada')).toBeUndefined()
  })

  it('validates 6-digit verification codes', () => {
    expect(checkCode(' 012345 ')).toBeUndefined()
    expect(checkCode('')).toMatch(/enter the verification code/)
    expect(checkCode('12345')).toMatch(/6 digits/)
    expect(checkCode('12345a')).toMatch(/6 digits/)
  })

  it('validates avatar files', () => {
    expect(checkAvatar({ type: 'image/webp', size: 100 })).toBeUndefined()
    expect(checkAvatar({ type: 'image/svg+xml', size: 100 })).toMatch(/PNG/)
    expect(checkAvatar({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toMatch(/2 MB/)
  })

  it('collects only failing checks', () => {
    expect(collectErrors({ email: undefined, password: 'Too short' })).toEqual({ password: 'Too short' })
  })
})

describe('safeRedirect', () => {
  it('only accepts in-app paths', () => {
    expect(safeRedirect('/hero/base?x=1')).toBe('/hero/base?x=1')
    for (const target of [undefined, '', 'https://evil.test', '//evil.test', '/\\evil.test'])
      expect(safeRedirect(target)).toBe('/account')
  })
})
