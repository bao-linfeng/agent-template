import { validateEnv } from './env.js'

describe('validateEnv', () => {
  it('applies local defaults outside production', () => {
    const env = validateEnv({})
    expect(env.PORT).toBe(3100)
    expect(env.API_PREFIX).toBe('api')
    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:5175',
      'http://localhost:5174',
    ])
    expect(env.COOKIE_SECURE).toBe(false)
    expect(env.SWAGGER_ENABLED).toBe(true)
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
    expect(Buffer.from(env.ENCRYPTION_KEY, 'base64')).toHaveLength(32)
  })

  it('coerces numbers, booleans and lists', () => {
    const env = validateEnv({
      PORT: '4000',
      TRUST_PROXY: 'true',
      CORS_ORIGINS: 'https://a.test, https://b.test',
    })
    expect(env.PORT).toBe(4000)
    expect(env.TRUST_PROXY).toBe(true)
    expect(env.CORS_ORIGINS).toEqual(['https://a.test', 'https://b.test'])
  })

  it('keeps the metrics listener off the API port', () => {
    expect(validateEnv({}).METRICS_PORT).toBe(9464)
    expect(() => validateEnv({ PORT: '9464' })).toThrow(
      /METRICS_PORT must differ from PORT/,
    )
    expect(
      validateEnv({ PORT: '9464', METRICS_ENABLED: 'false' }).METRICS_ENABLED,
    ).toBe(false)
  })

  it('enables tracing only when an OTLP endpoint is set', () => {
    expect(validateEnv({}).TRACING_ENABLED).toBe(false)
    const env = validateEnv({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://tempo:4318',
    })
    expect(env.TRACING_ENABLED).toBe(true)
    expect(env.OTEL_SERVICE_NAME).toBe('agent-template-server')
    expect(env.OTEL_TRACES_SAMPLER_ARG).toBe(1)
    expect(
      validateEnv({
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://tempo:4318/v1/traces',
      }).TRACING_ENABLED,
    ).toBe(true)
    expect(
      validateEnv({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://tempo:4318',
        OTEL_SDK_DISABLED: 'true',
      }).TRACING_ENABLED,
    ).toBe(false)
    expect(() => validateEnv({ OTEL_TRACES_SAMPLER_ARG: '2' })).toThrow(
      /OTEL_TRACES_SAMPLER_ARG/,
    )
  })

  it('requires secrets in production and enables secure defaults', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET must be set in production/,
    )

    const env = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(48),
      ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    })
    expect(env.COOKIE_SECURE).toBe(true)
    expect(env.SWAGGER_ENABLED).toBe(false)
  })

  it('rejects malformed values with a readable message', () => {
    expect(() => validateEnv({ ENCRYPTION_KEY: 'short' })).toThrow(
      /ENCRYPTION_KEY/,
    )
    expect(() => validateEnv({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/)
  })
})
