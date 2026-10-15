import { randomToken, safeEqualHex, SecretBox, sha256 } from './crypto.js'

describe('crypto helpers', () => {
  it('generates URL-safe random tokens', () => {
    const token = randomToken()
    expect(token).toMatch(/^[\w-]{43}$/)
    expect(randomToken()).not.toBe(token)
  })

  it('compares hex digests safely', () => {
    expect(safeEqualHex(sha256('a'), sha256('a'))).toBe(true)
    expect(safeEqualHex(sha256('a'), sha256('b'))).toBe(false)
    expect(safeEqualHex(sha256('a'), 'abcd')).toBe(false)
  })
})

describe('SecretBox', () => {
  const box = new SecretBox(Buffer.alloc(32, 7).toString('base64'))

  it('round-trips secrets with a random IV', () => {
    const first = box.encrypt('sk-secret')
    expect(first).toMatch(/^v1\./)
    expect(box.encrypt('sk-secret')).not.toBe(first)
    expect(box.decrypt(first)).toBe('sk-secret')
  })

  it('detects tampering and wrong keys', () => {
    const payload = box.encrypt('sk-secret')
    const [version, iv, tag, data] = payload.split('.')
    const tampered = [
      version,
      iv,
      tag,
      Buffer.from('other').toString('base64url') + data,
    ].join('.')
    expect(() => box.decrypt(tampered)).toThrow()
    expect(() =>
      new SecretBox(Buffer.alloc(32, 8).toString('base64')).decrypt(payload),
    ).toThrow()
  })

  it('rejects keys that are not 32 bytes', () => {
    expect(() => new SecretBox(Buffer.alloc(16).toString('base64'))).toThrow(
      /32 bytes/,
    )
  })
})
