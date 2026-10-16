import type { IncomingMessage } from 'node:http'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  trace,
  TraceFlags,
} from '@opentelemetry/api'
import type { NodeSDK } from '@opentelemetry/sdk-node'
import {
  InMemorySpanExporter,
  SamplingDecision,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace'
import { registerTracingHook } from './http-tracing.js'
import {
  createTracingSdk,
  isUntracedRequest,
  TracingSampler,
  type TracingEnv,
} from './sdk.js'
import { TracingShutdown } from './tracing.module.js'

const enabled: TracingEnv = {
  TRACING_ENABLED: true,
  OTEL_SERVICE_NAME: 'test-server',
  OTEL_TRACES_SAMPLER_ARG: 1,
}

function sample(sampler: TracingSampler, name: string, parent = false) {
  const ctx = parent
    ? trace.setSpanContext(ROOT_CONTEXT, {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        traceFlags: TraceFlags.SAMPLED,
        isRemote: true,
      })
    : ROOT_CONTEXT
  return sampler.shouldSample(
    ctx,
    '0af7651916cd43dd8448eb211c80319c',
    name,
    SpanKind.INTERNAL,
    {},
    [],
  ).decision
}

describe('createTracingSdk', () => {
  it('returns nothing when no OTLP endpoint is configured', () => {
    expect(
      createTracingSdk({ ...enabled, TRACING_ENABLED: false }),
    ).toBeUndefined()
  })
})

describe('isUntracedRequest', () => {
  it('skips probes and metric scrapes', () => {
    const request = (url: string) => ({ url }) as IncomingMessage
    expect(isUntracedRequest(request('/api/health'))).toBe(true)
    expect(isUntracedRequest(request('/api/health/live?x=1'))).toBe(true)
    expect(isUntracedRequest(request('/metrics'))).toBe(true)
    expect(isUntracedRequest(request('/api/v1/admin/me'))).toBe(false)
    expect(isUntracedRequest(request('/api/v1/client/healthy'))).toBe(false)
  })
})

describe('TracingSampler', () => {
  it('never starts a trace for BullMQ housekeeping', () => {
    const sampler = new TracingSampler(1)
    expect(sample(sampler, 'getNextJob mail')).toBe(SamplingDecision.NOT_RECORD)
    expect(sample(sampler, 'moveStalledJobsToWait mail')).toBe(
      SamplingDecision.NOT_RECORD,
    )
    expect(sample(sampler, 'getNextJob mail', true)).toBe(
      SamplingDecision.RECORD_AND_SAMPLED,
    )
    expect(sample(sampler, 'process mail')).toBe(
      SamplingDecision.RECORD_AND_SAMPLED,
    )
  })

  it('samples new traces by ratio and follows the parent otherwise', () => {
    const sampler = new TracingSampler(0)
    expect(sample(sampler, 'GET /api/v1/admin/me')).toBe(
      SamplingDecision.NOT_RECORD,
    )
    expect(sample(sampler, 'GET /api/v1/admin/me', true)).toBe(
      SamplingDecision.RECORD_AND_SAMPLED,
    )
  })
})

describe('tracing with the SDK', () => {
  const exporter = new InMemorySpanExporter()
  let sdk: NodeSDK

  beforeAll(() => {
    sdk = createTracingSdk(enabled, [new SimpleSpanProcessor({ exporter })])!
    sdk.start()
  })

  afterAll(async () => {
    await sdk.shutdown()
    trace.disable()
    context.disable()
    propagation.disable()
  })

  it('names request spans by route and returns traceparent', async () => {
    // Loaded after the SDK started so the HTTP instrumentation sees the server.
    const { default: Fastify } = await import('fastify')
    const fastify = Fastify()
    registerTracingHook({
      getHttpAdapter: () => ({ getInstance: () => fastify }),
    } as unknown as NestFastifyApplication)
    fastify.get('/api/v1/items/:id', async () => ({ ok: true }))
    fastify.get('/api/health', async () => ({ status: 'ok' }))
    const base = await fastify.listen({ host: '127.0.0.1', port: 0 })
    try {
      const response = await fetch(`${base}/api/v1/items/42`)
      expect(response.status).toBe(200)
      await fetch(`${base}/api/health`)

      const server = exporter
        .getFinishedSpans()
        .filter((span) => span.kind === SpanKind.SERVER)
      expect(server.map((span) => span.name)).toEqual(['GET /api/v1/items/:id'])
      const [span] = server
      expect(span.attributes['http.route']).toBe('/api/v1/items/:id')
      expect(span.resource.attributes['service.name']).toBe('test-server')
      const { traceId, spanId } = span.spanContext()
      expect(response.headers.get('traceparent')).toBe(
        `00-${traceId}-${spanId}-01`,
      )
    } finally {
      await fastify.close()
    }
  })

  it('flushes and stops the provider on application shutdown', async () => {
    exporter.reset()
    await new TracingShutdown().onApplicationShutdown()
    trace.getTracer('test').startSpan('after shutdown').end()
    expect(exporter.getFinishedSpans()).toHaveLength(0)
  })
})
