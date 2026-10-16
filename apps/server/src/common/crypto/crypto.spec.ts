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
    expect(
      () =>
        new SecretBox(Buffer.alloc(32, 7).toString('base64'), [
          Buffer.alloc(16).toString('base64'),
        ]),
    ).toThrow(/32 bytes/)
  })

  it('rejects malformed payloads', () => {
    expect(() => box.decrypt('v2.a.b.c')).toThrow(/Unsupported/)
    expect(() => box.decrypt('not-encrypted')).toThrow(/Unsupported/)
    expect(() => box.isCurrent('not-encrypted')).toThrow(/Unsupported/)
  })
})

describe('SecretBox key rotation', () => {
  const oldKey = Buffer.alloc(32, 1).toString('base64')
  const olderKey = Buffer.alloc(32, 2).toString('base64')
  const newKey = Buffer.alloc(32, 3).toString('base64')
  const rotated = new SecretBox(newKey, [oldKey, olderKey])

  it('decrypts values written with any previous key', () => {
    expect(rotated.decrypt(new SecretBox(oldKey).encrypt('a'))).toBe('a')
    expect(rotated.decrypt(new SecretBox(olderKey).encrypt('b'))).toBe('b')
  })

  it('encrypts with the current key only, in the format the previous release reads', () => {
    const payload = rotated.encrypt('sk-secret')
    expect(payload).toMatch(/^v1\./)
    expect(new SecretBox(newKey).decrypt(payload)).toBe('sk-secret')
    expect(() => new SecretBox(oldKey).decrypt(payload)).toThrow()
  })

  it('tells current values from ones on a previous key', () => {
    expect(rotated.isCurrent(rotated.encrypt('a'))).toBe(true)
    expect(rotated.isCurrent(new SecretBox(oldKey).encrypt('a'))).toBe(false)
  })

  it('names both settings when no key matches', () => {
    const unknown = new SecretBox(Buffer.alloc(32, 4).toString('base64'))
    expect(() => rotated.decrypt(unknown.encrypt('a'))).toThrow(
      /ENCRYPTION_KEY or ENCRYPTION_KEYS_PREVIOUS/,
    )
    expect(rotated.isCurrent(unknown.encrypt('a'))).toBe(false)
  })
})
