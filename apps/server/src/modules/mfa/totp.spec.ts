import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  totpCode,
  totpStep,
  totpUri,
  verifyTotp,
} from './totp.js'

// RFC 6238 appendix B uses the ASCII secret "12345678901234567890" (SHA-1) and 8 digits; the 6-digit
// codes are the last six digits of those values.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))
const RFC_VECTORS: [number, string][] = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
]

describe('totp', () => {
  it('matches the RFC 6238 test vectors', () => {
    for (const [seconds, code] of RFC_VECTORS) {
      expect(totpCode(RFC_SECRET, seconds * 1000)).toBe(code)
    }
  })

  it('matches the RFC 4226 HOTP test vectors', () => {
    const secret = Buffer.from('12345678901234567890')
    expect(hotp(secret, 0)).toBe('755224')
    expect(hotp(secret, 1)).toBe('287082')
    expect(hotp(secret, 9)).toBe('520489')
  })

  it('round-trips base32 and tolerates user formatting', () => {
    const bytes = Buffer.from('any carnal pleasure')
    const encoded = base32Encode(bytes)
    expect(encoded).toBe('MFXHSIDDMFZG4YLMEBYGYZLBON2XEZI')
    expect(base32Decode(encoded)).toEqual(bytes)
    expect(
      base32Decode(`${encoded.toLowerCase().slice(0, 8)} ${encoded.slice(8)}=`),
    ).toEqual(bytes)
    expect(() => base32Decode('not base32!')).toThrow()
  })

  it('generates 160-bit secrets', () => {
    const secret = generateTotpSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(secret)).toHaveLength(20)
    expect(generateTotpSecret()).not.toBe(secret)
  })

  it('accepts one step of clock drift and returns the matching step', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    const step = totpStep(now)
    expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(step)
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(
      step - 1,
    )
    expect(verifyTotp(secret, totpCode(secret, now + 30_000), now)).toBe(
      step + 1,
    )
    expect(verifyTotp(secret, totpCode(secret, now - 60_000), now)).toBeNull()
    expect(verifyTotp(secret, totpCode(secret, now + 60_000), now)).toBeNull()
  })

  it('rejects malformed codes', () => {
    const secret = generateTotpSecret()
    expect(verifyTotp(secret, '12345')).toBeNull()
    expect(verifyTotp(secret, '1234567')).toBeNull()
    expect(verifyTotp(secret, 'abcdef')).toBeNull()
    expect(verifyTotp(secret, '')).toBeNull()
  })

  it('builds otpauth URIs with an escaped label', () => {
    const uri = totpUri({
      issuer: 'Agent Admin',
      account: 'a+b@example.com',
      secret: 'ABC',
    })
    const [label, query] = uri.split('?')
    expect(label).toBe('otpauth://totp/Agent%20Admin:a%2Bb%40example.com')
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({
      secret: 'ABC',
      issuer: 'Agent Admin',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    })
  })
})
