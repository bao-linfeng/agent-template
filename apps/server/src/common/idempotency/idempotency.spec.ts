import { AppException } from '../errors/app.exception.js'
import {
  parseIdempotencyKey,
  requestFingerprint,
  stableStringify,
} from './idempotency.js'

function codeOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    return error instanceof AppException ? error.code : 'not-app-exception'
  }
  return undefined
}

describe('parseIdempotencyKey', () => {
  it('accepts plain tokens and RFC 8941 strings', () => {
    expect(parseIdempotencyKey(undefined)).toBeUndefined()
    expect(parseIdempotencyKey('8e03978e-40d5-43e8')).toBe('8e03978e-40d5-43e8')
    expect(parseIdempotencyKey(' "abc 123" ')).toBe('abc 123')
  })

  it('rejects empty, oversized, non-ASCII and repeated keys', () => {
    for (const header of [
      '',
      '   ',
      '""',
      'x'.repeat(256),
      'clé',
      ['a', 'b'],
    ]) {
      expect(codeOf(() => parseIdempotencyKey(header))).toBe(
        'IDEMPOTENCY_KEY_INVALID',
      )
    }
    expect(parseIdempotencyKey('x'.repeat(255))).toHaveLength(255)
  })
})

describe('requestFingerprint', () => {
  it('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: undefined }, null] })).toBe(
      '{"a":[{"d":2},null],"b":1}',
    )
    expect(requestFingerprint('post', '/kb', { a: 1, b: { c: 2, d: 3 } })).toBe(
      requestFingerprint('POST', '/kb', { b: { d: 3, c: 2 }, a: 1 }),
    )
  })

  it('differs by method, URL and body', () => {
    const base = requestFingerprint('POST', '/kb?x=1', { name: 'a' })
    expect(requestFingerprint('PUT', '/kb?x=1', { name: 'a' })).not.toBe(base)
    expect(requestFingerprint('POST', '/kb?x=2', { name: 'a' })).not.toBe(base)
    expect(requestFingerprint('POST', '/kb?x=1', { name: 'b' })).not.toBe(base)
    expect(requestFingerprint('POST', '/kb?x=1', undefined)).toBe(
      requestFingerprint('POST', '/kb?x=1', null),
    )
  })
})
