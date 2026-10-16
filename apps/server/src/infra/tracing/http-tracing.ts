import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { context, propagation } from '@opentelemetry/api'
import { getRPCMetadata, RPCType } from '@opentelemetry/core'

/**
 * Names the HTTP server span after the Fastify route pattern (`GET /api/v1/admin/users/:id`, also set as
 * `http.route`) and returns its `traceparent`, so a response can be looked up in Tempo. No-op without
 * the tracing preload (`src/tracing.ts`).
 */
export function registerTracingHook(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      const active = context.active()
      const rpc = getRPCMetadata(active)
      const route = request.routeOptions.url
      if (rpc?.type === RPCType.HTTP && route) {
        rpc.route = route
      }
      const carrier: Record<string, string> = {}
      propagation.inject(active, carrier)
      if (carrier.traceparent) {
        void reply.header('traceparent', carrier.traceparent)
      }
    })
}
