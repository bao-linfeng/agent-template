import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { buildAuditEntry } from './audit-entry.js'
import { AuditService } from './audit.service.js'

/**
 * Records every audited request once its response has been sent, including requests rejected by
 * guards or failed with an error, without delaying the response.
 */
export function registerAuditHook(app: NestFastifyApplication): void {
  const audit = app.get(AuditService)
  if (!audit.enabled) {
    return
  }
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onResponse', async (request, reply) => {
      const entry = buildAuditEntry(
        request,
        { statusCode: reply.statusCode, durationMs: reply.elapsedTime },
        audit.recordReads,
      )
      if (entry) {
        audit.record(entry)
      }
    })
}
