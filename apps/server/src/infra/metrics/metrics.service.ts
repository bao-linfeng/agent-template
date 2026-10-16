import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client'
import type { Env } from '../../config/env.js'

export type HttpMetricLabels = 'method' | 'route' | 'status_code' | 'realm'

/**
 * Owns the Prometheus registry and serves it on a separate listener (`METRICS_HOST:METRICS_PORT`), so
 * `/metrics` never goes through the public gateway. Collectors register their metrics on `registry`.
 */
@Injectable()
export class MetricsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MetricsService.name)
  readonly enabled: boolean
  readonly registry = new Registry()
  readonly httpRequestDuration: Histogram<HttpMetricLabels>
  private server?: Server

  constructor(private readonly config: ConfigService<Env, true>) {
    this.enabled = config.get('METRICS_ENABLED', { infer: true })
    if (this.enabled) {
      // Process CPU/memory/handles, GC and event loop lag (`nodejs_eventloop_lag_*`).
      collectDefaultMetrics({ register: this.registry })
    }
    this.httpRequestDuration = new Histogram({
      name: 'http_server_request_duration_seconds',
      help: 'Duration of HTTP requests by route pattern',
      labelNames: ['method', 'route', 'status_code', 'realm'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    })
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      return
    }
    const host = this.config.get('METRICS_HOST', { infer: true })
    const port = this.config.get('METRICS_PORT', { infer: true })
    const server = createServer((request, response) => {
      void this.handle(request, response)
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => {
        server.off('error', reject)
        resolve()
      })
    })
    this.server = server
    this.logger.log(
      `Serving metrics on http://${host}:${this.address()?.port}/metrics`,
    )
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server
    if (!server) {
      return
    }
    this.server = undefined
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  /** Bound address of the metrics listener (useful with `METRICS_PORT=0`). */
  address(): AddressInfo | undefined {
    const address = this.server?.address()
    return address && typeof address === 'object' ? address : undefined
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== 'GET' || request.url?.split('?')[0] !== '/metrics') {
      response.writeHead(404).end()
      return
    }
    try {
      const body = await this.registry.metrics()
      response
        .writeHead(200, { 'content-type': this.registry.contentType })
        .end(body)
    } catch (error) {
      this.logger.error(`Collecting metrics failed: ${String(error)}`)
      response.writeHead(500).end()
    }
  }
}
