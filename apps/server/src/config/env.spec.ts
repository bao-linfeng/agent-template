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

  it('limits database statements, idle transactions and connection waits', () => {
    const env = validateEnv({})
    expect(env.DATABASE_STATEMENT_TIMEOUT_MS).toBe(30_000)
    expect(env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS).toBe(60_000)
    expect(env.DATABASE_CONNECTION_TIMEOUT_MS).toBe(5_000)
    expect(
      validateEnv({ DATABASE_STATEMENT_TIMEOUT_MS: '0' })
        .DATABASE_STATEMENT_TIMEOUT_MS,
    ).toBe(0)
    expect(() => validateEnv({ DATABASE_CONNECTION_TIMEOUT_MS: '-1' })).toThrow(
      /DATABASE_CONNECTION_TIMEOUT_MS/,
    )
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

  const production = {
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(48),
    ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    PUBLIC_URL: 'https://api.example.com',
    APP_WEB_URL: 'https://app.example.com',
    CORS_ORIGINS: 'https://admin.example.com,https://app.example.com',
    DATABASE_URL: 'postgres://app:secret@postgres:5432/app',
    REDIS_URL: 'redis://:secret@redis:6379',
    STORAGE_ACCESS_KEY: 'storage-access',
    STORAGE_SECRET_KEY: 'storage-secret',
  }

  it('requires secrets in production and enables secure defaults', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET must be set in production/,
    )

    const env = validateEnv(production)
    expect(env.COOKIE_SECURE).toBe(true)
    expect(env.SWAGGER_ENABLED).toBe(false)
    expect(env.CORS_ORIGINS).toEqual([
      'https://admin.example.com',
      'https://app.example.com',
    ])
  })

  it.each([
    'PUBLIC_URL',
    'APP_WEB_URL',
    'CORS_ORIGINS',
    'DATABASE_URL',
    'REDIS_URL',
  ])('requires %s in production instead of a localhost default', (key) => {
    expect(() => validateEnv({ ...production, [key]: undefined })).toThrow(
      new RegExp(`${key} must be set in production`),
    )
  })

  it('rejects missing or local storage credentials in production', () => {
    for (const value of [undefined, '', 'rustfsadmin']) {
      expect(() =>
        validateEnv({ ...production, STORAGE_SECRET_KEY: value }),
      ).toThrow(/STORAGE_SECRET_KEY must be set to real credentials/)
    }
    // Local development keeps working with the RustFS container defaults.
    expect(validateEnv({}).STORAGE_ACCESS_KEY).toBe('rustfsadmin')
  })

  it('accepts previous encryption keys for rotation', () => {
    const current = Buffer.alloc(32, 1).toString('base64')
    const previous = [2, 3].map((fill) =>
      Buffer.alloc(32, fill).toString('base64'),
    )
    expect(validateEnv({}).ENCRYPTION_KEYS_PREVIOUS).toEqual([])
    expect(
      validateEnv({
        ENCRYPTION_KEY: current,
        ENCRYPTION_KEYS_PREVIOUS: previous.join(', '),
      }).ENCRYPTION_KEYS_PREVIOUS,
    ).toEqual(previous)
    expect(() =>
      validateEnv({ ENCRYPTION_KEYS_PREVIOUS: `${previous[0]},short` }),
    ).toThrow(/ENCRYPTION_KEYS_PREVIOUS/)
    expect(() =>
      validateEnv({
        ENCRYPTION_KEY: current,
        ENCRYPTION_KEYS_PREVIOUS: `${previous[0]},${current}`,
      }),
    ).toThrow(/must not contain ENCRYPTION_KEY/)
  })

  it('rejects malformed values with a readable message', () => {
    expect(() => validateEnv({ ENCRYPTION_KEY: 'short' })).toThrow(
      /ENCRYPTION_KEY/,
    )
    expect(() => validateEnv({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/)
  })
})
