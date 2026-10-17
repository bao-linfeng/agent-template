import { z } from 'zod'
import type { Env } from '../../config/env.js'
import { VERIFICATION_CODE_MAX_ATTEMPTS } from '../auth/auth.constants.js'

/** Reads a validated env value; defaults of settings that replace an env variable read it through this. */
export type EnvReader = <K extends keyof Env>(key: K) => Env[K]

export interface SettingDefinition<S extends z.ZodType = z.ZodType> {
  /**
   * Validates submitted and stored values; its bounds are what administrators may set. A function
   * receives the env, so bounds can follow an env hard limit (stored values outside it are ignored).
   */
  schema: S | ((env: EnvReader) => S)
  /** Value while no override is stored, usually the env variable with the same meaning. */
  defaultValue: (env: EnvReader) => z.output<S>
  /** Readable without signing in through `GET /v1/client/settings` (flags the client UI needs). */
  public: boolean
  /** Shown in the admin console next to the setting. */
  description: string
}

function setting<S extends z.ZodType>(
  definition: SettingDefinition<S>,
): SettingDefinition<S> {
  return definition
}

/**
 * Integers from `min` up to an env hard limit: administrators may tighten the env value at runtime,
 * loosening it needs a deployment. `min` gives way when the env value itself is lower.
 */
function upTo(limit: number, min: number) {
  return z.number().int().min(Math.min(min, limit)).max(limit)
}

/**
 * Settings administrators change at runtime (`/v1/admin/settings`, permission `setting:*`), without a
 * restart. Infrastructure, secrets and switches that would weaken security or hide tracks (e.g.
 * `AUDIT_LOG_ENABLED`) stay env-only. To add one:
 *   1. declare it here with a bounded schema and its default; when it replaces an env limit, bound the
 *      schema by that env value (`upTo`) so the runtime value can only tighten it,
 *   2. read it with `SettingsService.get(key)` where it is used (never cache it in a field),
 *   3. document it in AGENTS.md; when it replaces an env variable, keep the variable as its default,
 *   4. translate its title and description for the admin console (`systemSettings.items.<key>`).
 * Keys are stable: rows of renamed or removed keys are ignored, and the previous release must still be
 * able to read every value it knows (keep the schema of an existing key compatible).
 */
export const SETTINGS = {
  'auth.registrationEnabled': setting({
    schema: z.boolean(),
    defaultValue: () => true,
    public: true,
    description:
      '允许客户端用户自助注册；关闭后注册与发送注册验证码返回 403 AUTH_REGISTRATION_DISABLED',
  }),
  'account.deletionGraceDays': setting({
    schema: z.number().int().min(0).max(365),
    defaultValue: (env) => env('ACCOUNT_DELETION_GRACE_DAYS'),
    public: false,
    description:
      '客户端用户申请注销后可恢复的天数，只影响之后的注销申请；0 表示下一次夜间清理即删除',
  }),
  'maintenance.authRecordRetentionDays': setting({
    schema: z.number().int().min(0).max(3650),
    defaultValue: (env) => env('AUTH_RECORD_RETENTION_DAYS'),
    public: false,
    description:
      '已过期或撤销的会话、已使用或过期的重置令牌保留天数；0 表示永久保留',
  }),
  'maintenance.storageOrphanSweepEnabled': setting({
    schema: z.boolean(),
    defaultValue: (env) => env('STORAGE_ORPHAN_SWEEP_ENABLED'),
    public: false,
    description: '每天 04:00 清理没有数据行引用的头像、知识库源文件和导出文件',
  }),
  'rateLimit.defaultLimit': setting({
    schema: (env) => upTo(env('THROTTLE_LIMIT'), 1),
    defaultValue: (env) => env('THROTTLE_LIMIT'),
    public: false,
    description:
      '每个 IP 在 THROTTLE_TTL_SECONDS 窗口内对每个接口的请求上限，超出返回 429；上限为 THROTTLE_LIMIT',
  }),
  'rateLimit.authLimit': setting({
    schema: (env) => upTo(env('AUTH_THROTTLE_LIMIT'), 1),
    defaultValue: (env) => env('AUTH_THROTTLE_LIMIT'),
    public: false,
    description:
      '登录、注册、验证码、找回密码、两步验证等凭据接口每个 IP 在 AUTH_THROTTLE_TTL_SECONDS 窗口内的请求上限；上限为 AUTH_THROTTLE_LIMIT',
  }),
  'session.adminTtlSeconds': setting({
    schema: (env) => upTo(env('REFRESH_TOKEN_TTL_SECONDS'), 300),
    defaultValue: (env) => env('REFRESH_TOKEN_TTL_SECONDS'),
    public: false,
    description:
      '管理端会话自登录起的有效期（秒，刷新不延长），只影响之后的登录；上限为 REFRESH_TOKEN_TTL_SECONDS',
  }),
  'session.clientIdleTtlSeconds': setting({
    schema: (env) => upTo(env('REFRESH_TOKEN_TTL_SECONDS'), 300),
    defaultValue: (env) => env('REFRESH_TOKEN_TTL_SECONDS'),
    public: false,
    description:
      '客户端会话无活动多久后过期（秒），每次刷新令牌重新计时；上限为 REFRESH_TOKEN_TTL_SECONDS',
  }),
  'session.clientMaxTtlSeconds': setting({
    schema: (env) => upTo(env('CLIENT_SESSION_MAX_TTL_SECONDS'), 300),
    defaultValue: (env) => env('CLIENT_SESSION_MAX_TTL_SECONDS'),
    public: false,
    description:
      '客户端会话自登录起最长有效期（秒），到期必须重新登录；上限为 CLIENT_SESSION_MAX_TTL_SECONDS',
  }),
  'auth.passwordResetTtlSeconds': setting({
    schema: (env) => upTo(env('PASSWORD_RESET_TTL_SECONDS'), 60),
    defaultValue: (env) => env('PASSWORD_RESET_TTL_SECONDS'),
    public: false,
    description:
      '重置密码链接的有效期（秒），只影响之后发出的链接；上限为 PASSWORD_RESET_TTL_SECONDS',
  }),
  'auth.emailCodeTtlSeconds': setting({
    schema: (env) => upTo(env('EMAIL_CODE_TTL_SECONDS'), 60),
    defaultValue: (env) => env('EMAIL_CODE_TTL_SECONDS'),
    public: false,
    description:
      '邮件验证码的有效期（秒），只影响之后发出的验证码；上限为 EMAIL_CODE_TTL_SECONDS',
  }),
  'auth.emailCodeResendSeconds': setting({
    schema: (env) => {
      const floor = env('EMAIL_CODE_RESEND_SECONDS')
      return z.number().int().min(floor).max(Math.max(floor, 3600))
    },
    defaultValue: (env) => env('EMAIL_CODE_RESEND_SECONDS'),
    public: false,
    description:
      '同一邮箱两次发送验证码的最短间隔（秒）；只能不低于 EMAIL_CODE_RESEND_SECONDS',
  }),
  'auth.emailCodeMaxAttempts': setting({
    schema: z.number().int().min(1).max(VERIFICATION_CODE_MAX_ATTEMPTS),
    defaultValue: () => VERIFICATION_CODE_MAX_ATTEMPTS,
    public: false,
    description: '每个邮件验证码允许输错的次数，用完即作废',
  }),
} as const

export type SettingKey = keyof typeof SETTINGS
export type SettingValue<K extends SettingKey> =
  (typeof SETTINGS)[K] extends SettingDefinition<infer S> ? z.output<S> : never
export type SettingValues = { [K in SettingKey]: SettingValue<K> }
/** Keys of settings holding a number, for code that picks one of several numeric settings. */
export type NumberSettingKey = {
  [K in SettingKey]: SettingValue<K> extends number ? K : never
}[SettingKey]

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[]

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS, key)
}

/** The schema of a setting under the running env (bounds of env-bound settings resolved). */
export function resolveSettingSchema(
  definition: SettingDefinition,
  env: EnvReader,
): z.ZodType {
  return typeof definition.schema === 'function'
    ? definition.schema(env)
    : definition.schema
}
