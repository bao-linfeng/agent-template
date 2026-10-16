import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { inArray, sql } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { systemSettings } from '../../database/schema/index.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import {
  isSettingKey,
  resolveSettingSchema,
  SETTING_KEYS,
  SETTINGS,
  type SettingKey,
  type SettingValue,
  type SettingValues,
} from './settings.catalog.js'

/** Instances reload their snapshot when a message arrives here. */
export const SETTINGS_CHANNEL = 'settings:changed'
/** Safety net for missed pub/sub messages (e.g. while Redis reconnects). */
const RELOAD_INTERVAL_MS = 60_000

interface Override {
  value: unknown
  updatedAt: Date
  updatedBy: string | null
}

export interface SettingView {
  key: SettingKey
  /** Effective value: the override, else the default. */
  value: unknown
  defaultValue: unknown
  /** Whether an administrator changed it (`value` comes from the database). */
  overridden: boolean
  public: boolean
  description: string
  /** JSON Schema of the accepted values (type and bounds), for building forms. */
  schema: Record<string, unknown>
  updatedAt: Date | null
  updatedBy: string | null
}

/**
 * Runtime settings (`settings.catalog.ts`): defaults from env, overrides in `system_settings`. Every
 * instance keeps a snapshot in memory, so `get()` is synchronous and safe on hot paths; changes are
 * published on Redis and every instance reloads within moments (at the latest after a minute).
 */
@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name)
  private readonly defaults: SettingValues
  /** Schemas with env-bound limits resolved; they never change while the process runs. */
  private readonly schemas: Record<SettingKey, z.ZodType>
  private overrides = new Map<SettingKey, Override>()
  private loadGeneration = 0
  private subscriber?: Redis
  private timer?: NodeJS.Timeout

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    const env = <K extends keyof Env>(key: K): Env[K] =>
      config.get(key, { infer: true }) as Env[K]
    this.defaults = Object.fromEntries(
      SETTING_KEYS.map((key) => [key, SETTINGS[key].defaultValue(env)]),
    ) as SettingValues
    this.schemas = Object.fromEntries(
      SETTING_KEYS.map((key) => [
        key,
        resolveSettingSchema(SETTINGS[key], env),
      ]),
    ) as Record<SettingKey, z.ZodType>
  }

  async onModuleInit(): Promise<void> {
    await this.reload()
    this.subscriber = this.redis.duplicate()
    this.subscriber.on('error', (error: Error) =>
      this.logger.warn(`Settings subscriber: ${error.message}`),
    )
    this.subscriber.on('message', () => this.reloadInBackground())
    await this.subscriber.subscribe(SETTINGS_CHANNEL)
    this.timer = setInterval(
      () => this.reloadInBackground(),
      RELOAD_INTERVAL_MS,
    ).unref()
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer)
    await this.subscriber?.quit().catch(() => undefined)
  }

  get<K extends SettingKey>(key: K): SettingValue<K> {
    const override = this.overrides.get(key)
    return (override ? override.value : this.defaults[key]) as SettingValue<K>
  }

  list(): SettingView[] {
    return SETTING_KEYS.map((key) => {
      const definition = SETTINGS[key]
      const override = this.overrides.get(key)
      return {
        key,
        value: this.get(key),
        defaultValue: this.defaults[key],
        overridden: Boolean(override),
        public: definition.public,
        description: definition.description,
        schema: z.toJSONSchema(this.schemas[key]),
        updatedAt: override?.updatedAt ?? null,
        updatedBy: override?.updatedBy ?? null,
      }
    })
  }

  /** Effective values of the public settings, keyed by setting key. */
  publicValues(): Partial<SettingValues> {
    return Object.fromEntries(
      SETTING_KEYS.filter((key) => SETTINGS[key].public).map((key) => [
        key,
        this.get(key),
      ]),
    )
  }

  /**
   * Applies `changes` atomically (`null` restores the default) and makes every instance reload.
   * Unknown keys are 400 `SETTING_UNKNOWN`, values outside the schema 400 `SETTING_INVALID`.
   */
  async update(
    changes: Record<string, unknown>,
    adminUserId: string,
  ): Promise<SettingView[]> {
    const writes: { key: SettingKey; value: unknown }[] = []
    const resets: SettingKey[] = []
    for (const [key, value] of Object.entries(changes)) {
      if (!isSettingKey(key)) {
        throw new AppException('SETTING_UNKNOWN', { params: { key } })
      }
      if (value === null) {
        resets.push(key)
        continue
      }
      const parsed = this.schemas[key].safeParse(value)
      if (!parsed.success) {
        throw new AppException('SETTING_INVALID', {
          params: { key },
          details: parsed.error.issues.map(({ code, message }) => ({
            code,
            message,
          })),
        })
      }
      writes.push({ key, value: parsed.data })
    }
    if (writes.length === 0 && resets.length === 0) {
      return this.list()
    }

    await this.db.transaction(async (tx) => {
      if (resets.length > 0) {
        await tx
          .delete(systemSettings)
          .where(inArray(systemSettings.key, resets))
      }
      if (writes.length > 0) {
        await tx
          .insert(systemSettings)
          .values(writes.map((write) => ({ ...write, updatedBy: adminUserId })))
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              value: sql`excluded.value`,
              updatedBy: sql`excluded.updated_by`,
              updatedAt: sql`now()`,
            },
          })
      }
    })
    await this.reload()
    await this.redis.publish(SETTINGS_CHANNEL, '1')
    this.logger.log(
      `Admin ${adminUserId} changed settings: ${[...writes.map((write) => write.key), ...resets].join(', ')}`,
    )
    return this.list()
  }

  /** Re-reads the overrides; a newer load started meanwhile wins over this one. */
  async reload(): Promise<void> {
    const generation = ++this.loadGeneration
    const rows = await this.db.select().from(systemSettings)
    if (generation !== this.loadGeneration) {
      return
    }
    const overrides = new Map<SettingKey, Override>()
    for (const row of rows) {
      // Keys of other releases (renamed, removed or not yet known) are left alone.
      if (!isSettingKey(row.key)) {
        continue
      }
      const parsed = this.schemas[row.key].safeParse(row.value)
      if (!parsed.success) {
        // Also happens when an env hard limit was lowered below the stored value.
        this.logger.warn(
          `Ignoring stored value of setting "${row.key}" that no longer matches its schema`,
        )
        continue
      }
      overrides.set(row.key, {
        value: parsed.data,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      })
    }
    this.overrides = overrides
  }

  private reloadInBackground(): void {
    this.reload().catch((error: unknown) =>
      this.logger.warn(
        `Reloading settings failed, keeping the previous values: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
  }
}
