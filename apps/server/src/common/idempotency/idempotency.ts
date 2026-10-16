import { SetMetadata } from '@nestjs/common'
import { sha256 } from '../crypto/crypto.js'
import { AppException } from '../errors/app.exception.js'

export const IDEMPOTENT_KEY = 'idempotency:options'
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key'
/** Response header set (to `true`) when the body is a stored response of an earlier request. */
export const IDEMPOTENT_REPLAYED_HEADER = 'idempotent-replayed'

export interface IdempotencyOptions {
  /** Reject requests without `Idempotency-Key` (400 `IDEMPOTENCY_KEY_REQUIRED`). Default: the header is optional. */
  required?: boolean
  /** How long a successful response is replayed for the same key. Default 24 h. */
  ttlSeconds?: number
}

/**
 * Makes a write route safe to retry: a request carrying an `Idempotency-Key` header runs at most
 * once per account (anonymous callers: per IP) within `ttlSeconds`; retries get the stored response
 * with `Idempotent-Replayed: true`, a concurrent duplicate gets 409 `IDEMPOTENCY_KEY_IN_PROGRESS`
 * and the same key with another method, URL or body gets 422 `IDEMPOTENCY_KEY_MISMATCH`. Failed
 * requests are not stored, so they can be retried with the same key. Only the JSON body is replayed
 * (status comes from the route), so do not use it on routes that set cookies or headers. Multipart
 * bodies are not part of the fingerprint.
 */
export const Idempotent = (options: IdempotencyOptions = {}) =>
  SetMetadata(IDEMPOTENT_KEY, options)

const KEY_PATTERN = /^[\x20-\x7e]{1,255}$/

/**
 * Reads the header (a plain token, or an RFC 8941 string as in the IETF draft: `"..."`).
 * `undefined` when absent; 400 `IDEMPOTENCY_KEY_INVALID` when malformed.
 */
export function parseIdempotencyKey(
  header: string | string[] | undefined,
): string | undefined {
  if (header === undefined) {
    return undefined
  }
  if (Array.isArray(header)) {
    throw new AppException('IDEMPOTENCY_KEY_INVALID')
  }
  const trimmed = header.trim()
  const key =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed
  if (!KEY_PATTERN.test(key) || !key.trim()) {
    throw new AppException('IDEMPOTENCY_KEY_INVALID')
  }
  return key
}

/** JSON with object keys sorted, so equal payloads hash equally whatever their key order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item ?? null)).join(',')}]`
  }
  if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** Identifies "the same request" for one key: method, URL (with query) and parsed body. */
export function requestFingerprint(
  method: string,
  url: string,
  body: unknown,
): string {
  return sha256(`${method.toUpperCase()} ${url}\n${stableStringify(body)}`)
}
