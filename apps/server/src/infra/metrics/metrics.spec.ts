import { EventEmitter } from 'node:events'
import { WorkerHost } from '@nestjs/bullmq'
import type { ConfigService } from '@nestjs/config'
import type { DiscoveryService, ModuleRef } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { Job, Queue, Worker } from 'bullmq'
import Fastify from 'fastify'
import type { Pool } from 'pg'
import type { Env } from '../../config/env.js'
import { registerMetricsHook } from './http-metrics.js'
import { MetricsService } from './metrics.service.js'
import { PoolMetrics } from './pool-metrics.js'
import {
  attemptSeconds,
  isFinalFailure,
  QueueMetrics,
} from './queue-metrics.js'

function createMetrics(env: Partial<Env> = {}) {
  const values: Partial<Env> = {
    METRICS_ENABLED: true,
    METRICS_HOST: '127.0.0.1',
    METRICS_PORT: 0,
    ...env,
  }
  const config = {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>
  return new MetricsService(config)
}

function job(overrides: Partial<Job> & { attempts?: number }): Job {
  const { attempts, ...rest } = overrides
  return {
    name: 'send',
    attemptsMade: 1,
    opts: { attempts },
    ...rest,
  } as unknown as Job
}

describe('MetricsService', () => {
  it('serves the registry on its own listener and nothing else', async () => {
    const metrics = createMetrics()
    await metrics.onApplicationBootstrap()
    try {
      const base = `http://127.0.0.1:${metrics.address()!.port}`
      const response = await fetch(`${base}/metrics`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/plain')
      const body = await response.text()
      expect(body).toContain('process_cpu_seconds_total')
      expect(body).toContain('nodejs_eventloop_lag_p99_seconds')

      expect((await fetch(`${base}/`)).status).toBe(404)
      expect((await fetch(`${base}/metrics`, { method: 'POST' })).status).toBe(
        404,
      )
    } finally {
      await metrics.onApplicationShutdown()
    }
    expect(metrics.address()).toBeUndefined()
  })

  it('does not listen or collect runtime metrics when disabled', async () => {
    const metrics = createMetrics({ METRICS_ENABLED: false })
    await metrics.onApplicationBootstrap()
    expect(metrics.address()).toBeUndefined()
    expect(await metrics.registry.metrics()).not.toContain(
      'process_cpu_seconds_total',
    )
  })
})

describe('registerMetricsHook', () => {
  async function setup() {
    const metrics = createMetrics()
    const fastify = Fastify()
    fastify.addHook('onRequest', async (request) => {
      if (request.url.startsWith('/api/v1/admin')) {
        request.audit = { realm: 'admin' } as typeof request.audit
      }
    })
    fastify.get('/api/v1/admin/users/:id', async () => ({ ok: true }))
    fastify.get('/api/health', async () => ({ status: 'ok' }))
    const app = {
      get: () => metrics,
      getHttpAdapter: () => ({ getInstance: () => fastify }),
    } as unknown as NestFastifyApplication
    registerMetricsHook(app)
    await fastify.ready()
    return { metrics, fastify }
  }

  it('labels requests by route pattern, status and realm', async () => {
    const { metrics, fastify } = await setup()
    await fastify.inject({ method: 'GET', url: '/api/v1/admin/users/1' })
    await fastify.inject({ method: 'GET', url: '/api/v1/admin/users/2' })
    await fastify.inject({ method: 'GET', url: '/nope/123' })
    await fastify.inject({ method: 'GET', url: '/api/health' })

    const body = await metrics.registry.metrics()
    expect(body).toContain(
      'http_server_request_duration_seconds_count{method="GET",route="/api/v1/admin/users/:id",status_code="200",realm="admin"} 2',
    )
    expect(body).toContain(
      'http_server_request_duration_seconds_count{method="GET",route="unmatched",status_code="404",realm="none"} 1',
    )
    expect(body).not.toContain('/api/health')
    await fastify.close()
  })
})

describe('queue metrics helpers', () => {
  it('treats exhausted attempts and unrecoverable errors as final', () => {
    const error = new Error('boom')
    expect(isFinalFailure(job({ attemptsMade: 1, attempts: 3 }), error)).toBe(
      false,
    )
    expect(isFinalFailure(job({ attemptsMade: 3, attempts: 3 }), error)).toBe(
      true,
    )
    // Jobs without `attempts` run once.
    expect(isFinalFailure(job({ attemptsMade: 1 }), error)).toBe(true)
    const unrecoverable = Object.assign(new Error('bad input'), {
      name: 'UnrecoverableError',
    })
    expect(
      isFinalFailure(job({ attemptsMade: 1, attempts: 3 }), unrecoverable),
    ).toBe(true)
  })

  it('measures the last attempt', () => {
    expect(attemptSeconds(job({ processedOn: 1_000, finishedOn: 3_500 }))).toBe(
      2.5,
    )
    expect(attemptSeconds(job({}))).toBeUndefined()
  })
})

describe('QueueMetrics', () => {
  function setup() {
    const metrics = createMetrics()
    const queue = {
      name: 'mail',
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 4, failed: 1 }),
    }
    const worker = Object.assign(new EventEmitter(), { name: 'mail' })
    class MailProcessor extends WorkerHost {
      async process(): Promise<void> {}
    }
    const host = Object.assign(new MailProcessor(), { _worker: worker })
    const discovery = {
      getProviders: () => [
        { instance: host },
        { instance: {} },
        { instance: undefined },
      ],
    } as unknown as DiscoveryService
    const moduleRef = {
      get: (token: string) => {
        if (token.endsWith('mail')) {
          return queue as unknown as Queue
        }
        throw new Error('not registered')
      },
    } as unknown as ModuleRef
    const collector = new QueueMetrics(metrics, discovery, moduleRef)
    collector.onApplicationBootstrap()
    return {
      metrics,
      queue,
      worker: worker as unknown as Worker & EventEmitter,
    }
  }

  it('exports cached job counts per state for registered queues', async () => {
    const { metrics, queue } = setup()
    const body = await metrics.registry.metrics()
    expect(body).toContain('bullmq_queue_jobs{queue="mail",state="waiting"} 4')
    expect(body).toContain('bullmq_queue_jobs{queue="mail",state="failed"} 1')
    expect(body).toContain('bullmq_queue_jobs{queue="mail",state="active"} 0')
    expect(body).not.toContain('queue="rag-ingest"')

    await metrics.registry.metrics()
    expect(queue.getJobCounts).toHaveBeenCalledTimes(1)
  })

  it('keeps the last counts when Redis fails', async () => {
    const { metrics, queue } = setup()
    await metrics.registry.metrics()
    queue.getJobCounts.mockRejectedValue(new Error('redis down'))
    vi.useFakeTimers({ now: Date.now() + 60_000 })
    try {
      const body = await metrics.registry.metrics()
      expect(body).toContain(
        'bullmq_queue_jobs{queue="mail",state="waiting"} 4',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts attempts, final failures and last success of discovered workers', async () => {
    const { metrics, worker } = setup()
    worker.emit(
      'completed',
      job({ name: 'send', processedOn: 1_000, finishedOn: 2_000 }),
    )
    worker.emit(
      'failed',
      job({ name: 'send', attemptsMade: 1, attempts: 3, processedOn: 1_000 }),
      new Error('smtp down'),
    )
    worker.emit(
      'failed',
      job({ name: 'send', attemptsMade: 3, attempts: 3, processedOn: 1_000 }),
      new Error('smtp down'),
    )
    worker.emit('failed', undefined, new Error('stalled'))

    const body = await metrics.registry.metrics()
    expect(body).toContain(
      'bullmq_jobs_processed_total{queue="mail",name="send",status="completed"} 1',
    )
    expect(body).toContain(
      'bullmq_jobs_processed_total{queue="mail",name="send",status="failed"} 2',
    )
    expect(body).toContain(
      'bullmq_jobs_failed_final_total{queue="mail",name="send"} 1',
    )
    expect(body).toContain(
      'bullmq_jobs_failed_final_total{queue="mail",name="unknown"} 1',
    )
    expect(body).toContain(
      'bullmq_job_duration_seconds_count{queue="mail",name="send",status="completed"} 1',
    )
    expect(body).toContain(
      'bullmq_job_last_success_timestamp_seconds{queue="mail",name="send"} 2',
    )
  })
})

describe('PoolMetrics', () => {
  it('reports pool usage on scrape', async () => {
    const metrics = createMetrics()
    const pool = {
      totalCount: 3,
      idleCount: 1,
      waitingCount: 2,
      options: { max: 10 },
    } as unknown as Pool
    new PoolMetrics(metrics, pool).onModuleInit()
    const body = await metrics.registry.metrics()
    expect(body).toContain('pg_pool_connections{state="total"} 3')
    expect(body).toContain('pg_pool_connections{state="idle"} 1')
    expect(body).toContain('pg_pool_waiting_requests 2')
    expect(body).toContain('pg_pool_max_connections 10')
  })
})
