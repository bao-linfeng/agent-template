import { z } from 'zod'

const DEV_JWT_SECRET = 'local-development-only-jwt-secret-change-me'
// 32 zero bytes, base64. Only usable outside production.
const DEV_ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1')

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
)

const base64Key32 = z
  .string()
  .refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'must be 32 bytes encoded as base64 (openssl rand -base64 32)',
  })

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(3100),
    API_PREFIX: z.string().default('api'),
    /** Public base URL of this API, used to build absolute links such as avatar URLs. */
    PUBLIC_URL: z.url().default('http://localhost:3100'),
    /** Public URL of the web app that renders links sent by email (e.g. reset-password page). */
    APP_WEB_URL: z.url().default('http://localhost:5175'),
    CORS_ORIGINS: csv.default([
      'http://localhost:5175',
      'http://localhost:5174',
    ]),
    TRUST_PROXY: booleanString.default(false),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SWAGGER_ENABLED: booleanString.optional(),

    DATABASE_URL: z.string().default('postgres://app:app@localhost:5432/app'),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    JWT_SECRET: z.string().min(32).optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60),
    /** Client sessions slide by `REFRESH_TOKEN_TTL_SECONDS` on every refresh, but end this long after sign-in. */
    CLIENT_SESSION_MAX_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(30 * 24 * 60 * 60),
    PASSWORD_RESET_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(30 * 60),
    /** Lifetime of emailed verification codes (registration). */
    EMAIL_CODE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 60),
    /** Minimum wait before another code can be requested for the same email. */
    EMAIL_CODE_RESEND_SECONDS: z.coerce.number().int().positive().default(60),
    /** Issuer shown next to admin accounts in authenticator apps (two-factor authentication). */
    MFA_TOTP_ISSUER: z.string().trim().min(1).max(64).default('Agent Admin'),
    PASSWORD_HASH_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    COOKIE_SECURE: booleanString.optional(),
    COOKIE_DOMAIN: z.string().optional(),
    /** AES-256-GCM key for secrets stored in the database (e.g. embedding provider API keys). */
    ENCRYPTION_KEY: base64Key32.optional(),

    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
    /** Stricter per-IP limit for credential endpoints (login, register, codes, password reset). */
    AUTH_THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),

    STORAGE_ENDPOINT: z.url().default('http://localhost:9000'),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_ACCESS_KEY: z.string().default('rustfsadmin'),
    STORAGE_SECRET_KEY: z.string().default('rustfsadmin'),
    STORAGE_BUCKET: z.string().default('app'),
    STORAGE_FORCE_PATH_STYLE: booleanString.default(true),
    /** Create the bucket on startup when missing (disable if the credentials cannot create buckets). */
    STORAGE_AUTO_CREATE_BUCKET: booleanString.default(true),
    AVATAR_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(2 * 1024 * 1024),
    UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),

    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('Agent Template <no-reply@example.com>'),

    /** Records API requests in `audit_logs` (see `modules/audit`). */
    AUDIT_LOG_ENABLED: booleanString.default(true),
    /** Also record GET/HEAD requests; writes are always recorded. */
    AUDIT_LOG_READS: booleanString.default(false),
    /** Rows older than this are deleted daily; 0 keeps them forever. */
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(0).default(180),

    /** Expired/revoked sessions and used/expired reset tokens are deleted daily this many days later; 0 keeps them forever. */
    AUTH_RECORD_RETENTION_DAYS: z.coerce.number().int().min(0).default(30),
    /** Daily sweep of avatar and RAG source objects that no database row references anymore. */
    STORAGE_ORPHAN_SWEEP_ENABLED: booleanString.default(true),

    /** Days a client user can restore an account after requesting its deletion; the nightly purge then deletes it with all its data. 0 = purged by the next run. */
    ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().min(0).default(15),
    /** How long a finished personal data export stays downloadable before it is deleted. */
    ACCOUNT_EXPORT_TTL_HOURS: z.coerce.number().int().positive().default(72),

    /** Prometheus metrics on a separate internal listener (`http://<METRICS_HOST>:<METRICS_PORT>/metrics`). */
    METRICS_ENABLED: booleanString.default(true),
    METRICS_HOST: z.string().default('0.0.0.0'),
    /** Keep it unreachable from the internet (the gateway only proxies `PORT`); 0 picks a free port. */
    METRICS_PORT: z.coerce.number().int().min(0).max(65_535).default(9464),

    /**
     * OpenTelemetry tracing (see `src/tracing.ts`, needs `node --import ./dist/tracing.js`): enabled when an
     * OTLP endpoint is set. The SDK reads the other standard variables itself (`OTEL_EXPORTER_OTLP_HEADERS`,
     * `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_RESOURCE_ATTRIBUTES`, ...).
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url().optional(),
    OTEL_SDK_DISABLED: booleanString.default(false),
    OTEL_SERVICE_NAME: z
      .string()
      .trim()
      .min(1)
      .default('agent-template-server'),
    /** Share of new traces that are kept; requests continuing an upstream trace follow its decision. */
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(1),
  })
  .superRefine((env, ctx) => {
    if (env.METRICS_ENABLED && env.METRICS_PORT === env.PORT) {
      ctx.addIssue({
        code: 'custom',
        path: ['METRICS_PORT'],
        message: 'METRICS_PORT must differ from PORT',
      })
    }
    if (env.NODE_ENV !== 'production') {
      return
    }
    for (const key of ['JWT_SECRET', 'ENCRYPTION_KEY'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} must be set in production`,
        })
      }
    }
  })
  .transform((env) => {
    const isProduction = env.NODE_ENV === 'production'
    return {
      ...env,
      JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET,
      ENCRYPTION_KEY: env.ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY,
      COOKIE_SECURE: env.COOKIE_SECURE ?? isProduction,
      SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? !isProduction,
      TRACING_ENABLED:
        !env.OTEL_SDK_DISABLED &&
        Boolean(
          env.OTEL_EXPORTER_OTLP_ENDPOINT ??
          env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
        ),
    }
  })

export type Env = z.output<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    )
  }
  return result.data
}
