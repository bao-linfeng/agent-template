import type { HttpRequest } from '../../common/http/request.js'
import type { NewAuditLogRow } from '../../database/schema/index.js'
import { sanitize, sanitizeRecord, shouldRecord } from './audit-context.js'

export interface AuditResponse {
  statusCode: number
  durationMs: number
}

const clip = (value: string, max: number) => value.slice(0, max)

function submittedEmail(body: unknown): string | undefined {
  const email = (body as { email?: unknown } | null | undefined)?.email
  return typeof email === 'string'
    ? clip(email.trim().toLowerCase(), 255)
    : undefined
}

/**
 * Audit row of a finished request, or undefined when it is not audited: requests that never reached
 * a Nest route (unknown paths, body parse errors) have no `request.audit`, and `shouldRecord` filters
 * by mode and method.
 */
export function buildAuditEntry(
  request: HttpRequest,
  response: AuditResponse,
  recordReads: boolean,
): NewAuditLogRow | undefined {
  const context = request.audit
  if (
    !context ||
    !shouldRecord(
      request.method,
      response.statusCode,
      context.mode,
      recordReads,
    )
  ) {
    return undefined
  }
  const redact = new Set(context.redact)
  // Router params and the parsed query are not plain objects; copy their own keys first.
  const params = sanitizeRecord({ ...(request.params as object) })
  const routeId = typeof params?.id === 'string' ? params.id : undefined
  const actor = request.user ?? context.actor
  const userAgent = request.headers['user-agent']
  const body = sanitize(request.body, redact)
  return {
    realm: context.realm ?? null,
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? submittedEmail(request.body) ?? null,
    action: clip(context.action, 200),
    method: request.method,
    route: request.routeOptions.url ?? request.url.split('?')[0]!,
    path: clip(request.url.split('?')[0]!, 2000),
    resourceId: (routeId ?? context.resourceId)?.slice(0, 100) ?? null,
    params,
    query: sanitizeRecord({ ...(request.query as object) }, redact),
    body: body ?? null,
    statusCode: response.statusCode,
    errorCode: context.errorCode ?? null,
    durationMs: Math.round(response.durationMs),
    ip: request.ip ? clip(request.ip, 64) : null,
    userAgent: typeof userAgent === 'string' ? clip(userAgent, 500) : null,
    // `x-request-id`, also used by the HTTP logs (see `createFastifyAdapter`).
    requestId: request.id ? clip(String(request.id), 100) : null,
    createdAt: new Date(),
  }
}
