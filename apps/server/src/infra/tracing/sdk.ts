import type { IncomingMessage } from 'node:http'
import {
  trace,
  type Attributes,
  type Context,
  type Link,
  type SpanKind,
} from '@opentelemetry/api'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { NodeSDK } from '@opentelemetry/sdk-node'
import {
  ParentBasedSampler,
  SamplingDecision,
  TraceIdRatioBasedSampler,
  type Sampler,
  type SamplingResult,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace'
import type { Env } from '../../config/env.js'

export type TracingEnv = Pick<
  Env,
  'TRACING_ENABLED' | 'OTEL_SERVICE_NAME' | 'OTEL_TRACES_SAMPLER_ARG'
>

/**
 * Probes and Prometheus scrapes (the metrics listener runs in the same process), and notification event
 * streams, whose request span would stay open for the whole connection.
 */
const UNTRACED_PATH = /\/(health(\/live)?|metrics|notifications\/stream)$/

/** BullMQ worker housekeeping that runs every few seconds even when the queues are idle. */
const BACKGROUND_SPAN =
  /^(getNextJob|moveStalledJobsToWait|startStalledCheckTimer|promoteJobs|trimEvents|rateLimit)( |$)/

export function isUntracedRequest(request: IncomingMessage): boolean {
  return UNTRACED_PATH.test(request.url?.split('?')[0] ?? '')
}

/**
 * Parent-based ratio sampling (`OTEL_TRACES_SAMPLER_ARG` of new traces) that never starts a trace for
 * BullMQ's polling and stalled-job checks; those spans are still kept inside a job's trace.
 */
export class TracingSampler implements Sampler {
  private readonly delegate: Sampler

  constructor(ratio: number) {
    this.delegate = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(ratio),
    })
  }

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    if (!trace.getSpanContext(context) && BACKGROUND_SPAN.test(spanName)) {
      return { decision: SamplingDecision.NOT_RECORD }
    }
    return this.delegate.shouldSample(
      context,
      traceId,
      spanName,
      spanKind,
      attributes,
      links,
    )
  }

  toString(): string {
    return `TracingSampler{${this.delegate.toString()}}`
  }
}

export function createInstrumentations(): Instrumentation[] {
  return [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: isUntracedRequest,
      // Outgoing calls (object storage, ...) only inside a request or job, not at startup.
      requireParentforOutgoingSpans: true,
    }),
    // `fetch` (embedding providers).
    new UndiciInstrumentation({ requireParentforSpans: true }),
    // BullMQ polls Redis constantly: keep only commands and queries issued by a request or job.
    new PgInstrumentation({ requireParentSpan: true }),
    new IORedisInstrumentation({ requireParentSpan: true }),
    // Adds trace_id/span_id to log lines; logs keep going to stdout only.
    new PinoInstrumentation({ disableLogSending: true }),
  ]
}

/**
 * Builds the SDK, or `undefined` when tracing is off. Spans go to the OTLP exporter configured by the
 * standard `OTEL_EXPORTER_OTLP_*` variables unless `spanProcessors` are given (tests).
 */
export function createTracingSdk(
  env: TracingEnv,
  spanProcessors?: SpanProcessor[],
): NodeSDK | undefined {
  if (!env.TRACING_ENABLED) {
    return undefined
  }
  return new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    sampler: new TracingSampler(env.OTEL_TRACES_SAMPLER_ARG),
    spanProcessors,
    // Traces only: metrics are scraped by Prometheus (infra/metrics) and logs stay on stdout.
    metricReaders: [],
    logRecordProcessors: [],
    instrumentations: createInstrumentations(),
  })
}
