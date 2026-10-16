import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** RFC 6238 parameters understood by every authenticator app (Google/Microsoft Authenticator, 1Password...). */
export const TOTP_PERIOD_SECONDS = 30
export const TOTP_DIGITS = 6
/** Accepted clock drift in periods on each side of the current one. */
export const TOTP_WINDOW = 1
const SECRET_BYTES = 20

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** RFC 4648 base32 without padding, the format of the `secret` parameter of `otpauth://` URIs. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

/** Accepts lower case, spaces and `=` padding, as users may type secrets by hand. */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const output: number[] = []
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error('Invalid base32 character')
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

/** New random secret (160 bits, as RFC 4226 recommends), base32 encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES))
}

/** Time step (counter) of a moment. */
export function totpStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS)
}

/** HOTP value (RFC 4226, HMAC-SHA1) of a counter, zero-padded to `TOTP_DIGITS`. */
export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', secret).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary = digest.readUInt32BE(offset) & 0x7fffffff
  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0')
}

/** Code shown by authenticator apps for `secret` (base32) at `now`. */
export function totpCode(secret: string, now = Date.now()): string {
  return hotp(base32Decode(secret), totpStep(now))
}

/**
 * Checks a code against the current step ± `TOTP_WINDOW` and returns the matching step, or null. Callers
 * must persist the step and reject codes of the same or an older step, so a code works only once.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
): number | null {
  if (!/^\d+$/.test(code) || code.length !== TOTP_DIGITS) {
    return null
  }
  const key = base32Decode(secret)
  const current = totpStep(now)
  const presented = Buffer.from(code)
  let matched: number | null = null
  // Check every step (no early exit) so timing does not reveal which one matched.
  for (
    let step = current - TOTP_WINDOW;
    step <= current + TOTP_WINDOW;
    step++
  ) {
    if (timingSafeEqual(Buffer.from(hotp(key, step)), presented)) {
      matched ??= step
    }
  }
  return matched
}

/** `otpauth://totp/...` URI that authenticator apps import from a QR code. */
export function totpUri(input: {
  issuer: string
  account: string
  secret: string
}): string {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.account)}`
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
