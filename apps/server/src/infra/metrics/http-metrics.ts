import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { HttpRequest } from '../../common/http/request.js'
import { MetricsService } from './metrics.service.js'

/**
 * Probes are scraped every few seconds and would drown the real traffic; event streams stay open for
 * minutes and would dominate the latency quantiles (`HighLatency` aggregates every route).
 */
const UNMEASURED_ROUTE = /\/(health(\/live)?|notifications\/stream)$/

/**
 * Route label of a request: the Fastify route pattern (`/api/v1/admin/users/:id`), never the raw
 * path, so ids do not create a time series each. Requests that matched no route share `unmatched`.
 */
export function routeLabel(request: HttpRequest): string {
  return request.routeOptions.url ?? 'unmatched'
}

/** Observes the duration of every response in `http_server_request_duration_seconds`. */
export function registerMetricsHook(app: NestFastifyApplication): void {
  const metrics = app.get(MetricsService)
  if (!metrics.enabled) {
    return
  }
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onResponse', async (request, reply) => {
      const route = routeLabel(request)
      if (UNMEASURED_ROUTE.test(route)) {
        return
      }
      metrics.httpRequestDuration.observe(
        {
          method: request.method,
          route,
          status_code: String(reply.statusCode),
          // Set by `AuditGuard` for routed requests; `none` for public and unmatched ones.
          realm: request.audit?.realm ?? 'none',
        },
        reply.elapsedTime / 1000,
      )
    })
}
