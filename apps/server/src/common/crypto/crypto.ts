import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const CIPHER = 'aes-256-gcm'
const IV_BYTES = 12
const VERSION = 'v1'

/** URL-safe random token, e.g. for refresh / password-reset secrets. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Constant-time comparison for hex digests of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Symmetric encryption for secrets at rest. Output format: `v1.<iv>.<tag>.<ciphertext>` (base64url).
 *
 * Key rotation: new values are always encrypted with the current key; previous keys only decrypt.
 * The payload names no key, so `decrypt` tries the current key first, then the previous ones (the GCM
 * tag rejects a wrong key). Keeping the format unchanged lets the previous release read every value
 * written with the key it knows. `scripts/reencrypt-secrets.ts` moves stored values to the current key.
 */
export class SecretBox {
  private readonly keys: readonly Buffer[]

  constructor(currentKey: string, previousKeys: readonly string[] = []) {
    this.keys = [currentKey, ...previousKeys].map((value) => {
      const key = Buffer.from(value, 'base64')
      if (key.length !== 32) {
        throw new Error('SecretBox key must be 32 bytes')
      }
      return key
    })
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(CIPHER, this.keys[0]!, iv)
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
      .map((part) =>
        typeof part === 'string' ? part : part.toString('base64url'),
      )
      .join('.')
  }

  /** Decrypts with the current or any previous key; throws when none of them matches. */
  decrypt(payload: string): string {
    const parts = parsePayload(payload)
    for (const key of this.keys) {
      const plaintext = open(parts, key)
      if (plaintext !== null) {
        return plaintext
      }
    }
    throw new Error(
      'Encrypted value cannot be decrypted with ENCRYPTION_KEY or ENCRYPTION_KEYS_PREVIOUS',
    )
  }

  /** Whether `payload` was encrypted with the current key (false for previous or unknown keys). */
  isCurrent(payload: string): boolean {
    return open(parsePayload(payload), this.keys[0]!) !== null
  }
}

interface PayloadParts {
  iv: Buffer
  tag: Buffer
  ciphertext: Buffer
}

function parsePayload(payload: string): PayloadParts {
  const [version, iv, tag, ciphertext] = payload.split('.')
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error('Unsupported encrypted payload')
  }
  return {
    iv: Buffer.from(iv, 'base64url'),
    tag: Buffer.from(tag, 'base64url'),
    ciphertext: Buffer.from(ciphertext, 'base64url'),
  }
}

/** Plaintext, or null when the authentication tag does not match (wrong key or tampered data). */
function open(parts: PayloadParts, key: Buffer): string | null {
  const decipher = createDecipheriv(CIPHER, key, parts.iv)
  decipher.setAuthTag(parts.tag)
  try {
    return Buffer.concat([
      decipher.update(parts.ciphertext),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}
