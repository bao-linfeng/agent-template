import { z } from 'zod';

const DEV_JWT_SECRET = 'local-development-only-jwt-secret-change-me';
// 32 zero bytes, base64. Only usable outside production.
const DEV_ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const base64Key32 = z
  .string()
  .refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'must be 32 bytes encoded as base64 (openssl rand -base64 32)',
  });

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
    APP_WEB_URL: z.url().default('http://localhost:5173'),
    CORS_ORIGINS: csv.default([
      'http://localhost:5173',
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
    PASSWORD_RESET_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(30 * 60),
    PASSWORD_HASH_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    COOKIE_SECURE: booleanString.optional(),
    COOKIE_DOMAIN: z.string().optional(),
    /** AES-256-GCM key for secrets stored in the database (e.g. embedding provider API keys). */
    ENCRYPTION_KEY: base64Key32.optional(),

    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
    /** Stricter per-IP limit for credential endpoints (login, register, password reset). */
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

    OBSERVE_APP_KEY: z.string().optional(),
    OBSERVE_APP_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }
    for (const key of ['JWT_SECRET', 'ENCRYPTION_KEY'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} must be set in production`,
        });
      }
    }
  })
  .transform((env) => {
    const isProduction = env.NODE_ENV === 'production';
    return {
      ...env,
      JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET,
      ENCRYPTION_KEY: env.ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY,
      COOKIE_SECURE: env.COOKIE_SECURE ?? isProduction,
      SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? !isProduction,
    };
  });

export type Env = z.output<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
