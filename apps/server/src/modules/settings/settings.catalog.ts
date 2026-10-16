import { z } from 'zod'
import type { Env } from '../../config/env.js'

/** Reads a validated env value; defaults of settings that replace an env variable read it through this. */
export type EnvReader = <K extends keyof Env>(key: K) => Env[K]

export interface SettingDefinition<S extends z.ZodType = z.ZodType> {
  /** Validates submitted and stored values; its bounds are what administrators may set. */
  schema: S
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
 * Settings administrators change at runtime (`/v1/admin/settings`, permission `setting:*`), without a
 * restart. Infrastructure, secrets and switches that would weaken security or hide tracks (e.g.
 * `AUDIT_LOG_ENABLED`) stay env-only. To add one:
 *   1. declare it here with a bounded schema and its default,
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
} as const

export type SettingKey = keyof typeof SETTINGS
export type SettingValue<K extends SettingKey> = z.output<
  (typeof SETTINGS)[K]['schema']
>
export type SettingValues = { [K in SettingKey]: SettingValue<K> }

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[]

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS, key)
}
