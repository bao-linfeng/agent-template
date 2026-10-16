import { SetMetadata } from '@nestjs/common'
import type { HttpRequest } from '../../common/http/request.js'
import type { Realm } from '../auth/realms.js'

export const AUDIT_KEY = 'audit:options'

/**
 * - `default`: writes (POST/PUT/PATCH/DELETE) always, reads only with `AUDIT_LOG_READS`;
 * - `always`: also reads, regardless of `AUDIT_LOG_READS`;
 * - `failures`: only responses >= 400 (e.g. token refresh, which succeeds every few minutes);
 * - `never`: not recorded.
 */
export type AuditMode = 'default' | 'always' | 'failures' | 'never'

export interface AuditOptions {
  /** Replaces the default action name `<Controller>.<handler>`. */
  action?: string
  mode?: AuditMode
  /** Extra body/query keys to redact besides the built-in secret patterns (e.g. `code`). */
  redact?: readonly string[]
}

/** Per-route audit settings; on a controller they apply to every route without their own `@Audit`. */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options)

/** Audit state of a request: set by `AuditGuard`, completed by the interceptor, exception filter and controllers. */
export interface AuditContext {
  action: string
  realm?: Realm
  mode: AuditMode
  redact: readonly string[]
  /** `id` of the record returned by the handler (used when the route has no `:id`). */
  resourceId?: string
  /** `code` of the error response. */
  errorCode?: string
  /** Account that signed in on a public credential route, where `request.user` is not set. */
  actor?: { id: string; email: string }
}

/** Records the account that a public route (login, register) signed in. */
export function setAuditActor(
  request: HttpRequest,
  account: { id: string; email: string },
): void {
  if (request.audit) {
    request.audit.actor = { id: account.id, email: account.email }
  }
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function shouldRecord(
  method: string,
  statusCode: number,
  mode: AuditMode,
  recordReads: boolean,
): boolean {
  switch (mode) {
    case 'never':
      return false
    case 'always':
      return true
    case 'failures':
      return statusCode >= 400
    default:
      return recordReads || !READ_METHODS.has(method)
  }
}

export const REDACTED = '[redacted]'
const SENSITIVE_KEY =
  /pass(word|wd)|secret|token|api[-_]?key|authorization|cookie|credential/i
const MAX_DEPTH = 6
const MAX_STRING = 1000
const MAX_ARRAY = 50
const MAX_KEYS = 100

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/**
 * JSON-safe copy of request data for the audit trail: values of secret-looking keys (and `extraKeys`)
 * become `[redacted]` (null/empty stay as they are, so "cleared" remains visible), long strings and
 * arrays are truncated and non-plain objects (buffers, streams) are replaced by a marker.
 */
export function sanitize(
  value: unknown,
  extraKeys: ReadonlySet<string> = new Set(),
  depth = 0,
): unknown {
  if (value === null || value === undefined) {
    return value ?? null
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[+${value.length - MAX_STRING} chars]`
      : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (depth >= MAX_DEPTH) {
    return '[truncated]'
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY)
      .map((item) => sanitize(item, extraKeys, depth + 1))
    if (value.length > MAX_ARRAY) {
      items.push(`…[+${value.length - MAX_ARRAY} items]`)
    }
    return items
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
      const secret = SENSITIVE_KEY.test(key) || extraKeys.has(key)
      result[key] =
        secret && item !== null && item !== undefined && item !== ''
          ? REDACTED
          : sanitize(item, extraKeys, depth + 1)
    }
    return result
  }
  if (typeof value === 'object') {
    return `[${value.constructor?.name ?? 'object'}]`
  }
  return undefined
}

/** Sanitized object, or null when it is not an object or has no keys. */
export function sanitizeRecord(
  value: unknown,
  extraKeys?: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    return null
  }
  return sanitize(value, extraKeys) as Record<string, unknown>
}
