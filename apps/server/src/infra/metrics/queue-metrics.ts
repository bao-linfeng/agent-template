import { getQueueToken, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { DiscoveryService, ModuleRef } from '@nestjs/core'
import type { Job, JobState, Queue, Worker } from 'bullmq'
import { Counter, Gauge, Histogram } from 'prom-client'
import { QUEUES } from '../queue/queue.module.js'
import { MetricsService } from './metrics.service.js'

/** States exported by `bullmq_queue_jobs`; completed/failed are bounded by `removeOnComplete`/`removeOnFail`. */
export const QUEUE_STATES: readonly JobState[] = [
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
  'failed',
  'completed',
]

/** Every scrape of every instance would otherwise hit Redis once per queue. */
const COUNTS_CACHE_MS = 10_000

/**
 * True when BullMQ will not retry the job: attempts are used up (the `failed` event fires after
 * `attemptsMade` was incremented) or the processor threw `UnrecoverableError`.
 */
export function isFinalFailure(job: Job, error: Error): boolean {
  return (
    error.name === 'UnrecoverableError' ||
    job.attemptsMade >= (job.opts.attempts ?? 1)
  )
}

/** Seconds the last attempt ran, or undefined when the timestamps are missing. */
export function attemptSeconds(job: Job): number | undefined {
  if (!job.processedOn) {
    return undefined
  }
  return Math.max(0, (job.finishedOn ?? Date.now()) - job.processedOn) / 1000
}

/**
 * BullMQ metrics for every queue in `QUEUES` and every `@Processor` (found through discovery, so new
 * queues are covered without extra code):
 * - `bullmq_queue_jobs{queue,state}`: jobs per state, read from Redis on scrape (cluster-wide, so
 *   every instance reports the same value; aggregate with `max by (queue, state)`).
 * - `bullmq_jobs_processed_total`, `bullmq_jobs_failed_final_total`, `bullmq_job_duration_seconds`
 *   and `bullmq_job_last_success_timestamp_seconds`: attempts run by this instance's workers.
 */
@Injectable()
export class QueueMetrics implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueueMetrics.name)
  private queues: Queue[] = []
  private cached?: { at: number; counts: Map<string, Record<string, number>> }

  constructor(
    private readonly metrics: MetricsService,
    private readonly discovery: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.metrics.enabled) {
      return
    }
    this.queues = Object.values(QUEUES).flatMap((name) => {
      try {
        return [
          this.moduleRef.get<Queue>(getQueueToken(name), { strict: false }),
        ]
      } catch {
        return []
      }
    })
    const workers = this.discovery
      .getProviders()
      .map((wrapper) => wrapper.instance as unknown)
      .filter(
        (instance): instance is WorkerHost => instance instanceof WorkerHost,
      )
      .map((host) => host.worker)
    this.register(workers)
  }

  /** Registers the metrics and listens to the given workers. */
  register(workers: Worker[]): void {
    const registers = [this.metrics.registry]
    const collectCounts = () => this.counts()
    new Gauge({
      name: 'bullmq_queue_jobs',
      help: 'Jobs per queue and state',
      labelNames: ['queue', 'state'],
      registers,
      async collect() {
        for (const [queue, counts] of await collectCounts()) {
          for (const state of QUEUE_STATES) {
            this.set({ queue, state }, counts[state] ?? 0)
          }
        }
      },
    })
    const processed = new Counter({
      name: 'bullmq_jobs_processed_total',
      help: 'Job attempts finished by this instance (failed includes attempts that will be retried)',
      labelNames: ['queue', 'name', 'status'],
      registers,
    })
    const failedFinal = new Counter({
      name: 'bullmq_jobs_failed_final_total',
      help: 'Jobs that failed without another retry',
      labelNames: ['queue', 'name'],
      registers,
    })
    const duration = new Histogram({
      name: 'bullmq_job_duration_seconds',
      help: 'Duration of job attempts',
      labelNames: ['queue', 'name', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 15, 60, 300, 900],
      registers,
    })
    const lastSuccess = new Gauge({
      name: 'bullmq_job_last_success_timestamp_seconds',
      help: 'Unix time of the last successful job per queue and job name (scheduled jobs: alert when it gets old)',
      labelNames: ['queue', 'name'],
      registers,
    })

    for (const worker of workers) {
      const queue = worker.name
      worker.on('completed', (job) => {
        const labels = { queue, name: job.name }
        processed.inc({ ...labels, status: 'completed' })
        const seconds = attemptSeconds(job)
        if (seconds !== undefined) {
          duration.observe({ ...labels, status: 'completed' }, seconds)
        }
        lastSuccess.set(labels, (job.finishedOn ?? Date.now()) / 1000)
      })
      worker.on('failed', (job, error) => {
        // Undefined when a stalled job exceeded its stall limit; that failure is final.
        const name = job?.name ?? 'unknown'
        processed.inc({ queue, name, status: 'failed' })
        if (job) {
          const seconds = attemptSeconds(job)
          if (seconds !== undefined) {
            duration.observe({ queue, name, status: 'failed' }, seconds)
          }
        }
        if (!job || isFinalFailure(job, error)) {
          failedFinal.inc({ queue, name })
        }
      })
    }
  }

  private async counts(): Promise<Map<string, Record<string, number>>> {
    if (this.cached && Date.now() - this.cached.at < COUNTS_CACHE_MS) {
      return this.cached.counts
    }
    try {
      const entries = await Promise.all(
        this.queues.map(
          async (queue) =>
            [queue.name, await queue.getJobCounts(...QUEUE_STATES)] as const,
        ),
      )
      this.cached = { at: Date.now(), counts: new Map(entries) }
    } catch (error) {
      // Keep serving the last values; readiness (`/health`) reports Redis outages.
      this.logger.warn(`Reading queue counts failed: ${String(error)}`)
    }
    return this.cached?.counts ?? new Map()
  }
}
