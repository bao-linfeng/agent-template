import type { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'
import type { Database } from '../../database/database.js'
import { SETTING_KEYS, SETTINGS } from './settings.catalog.js'
import { SETTINGS_CHANNEL, SettingsService } from './settings.service.js'

interface Row {
  key: string
  value: unknown
  updatedAt: Date
  updatedBy: string | null
}

const ADMIN = '0f8fad5b-d9cb-469f-a165-70867728950e'

function setup(env: Partial<Env> = {}) {
  const state = { rows: [] as Row[] }
  const writes: { values: unknown[]; deleted: number }[] = []
  // Each select resolves when the test says so, to control the order of concurrent loads.
  let selectGate: Promise<void> | undefined
  const tx = {
    delete: () => ({
      where: async () => {
        writes.push({ values: [], deleted: 1 })
      },
    }),
    insert: () => ({
      values: (values: unknown[]) => ({
        onConflictDoUpdate: async () => {
          writes.push({ values, deleted: 0 })
        },
      }),
    }),
  }
  const db = {
    select: () => ({
      from: async () => {
        const rows = [...state.rows]
        await selectGate
        return rows
      },
    }),
    transaction: async (run: (executor: typeof tx) => Promise<void>) => run(tx),
  }
  const redis = { publish: vi.fn().mockResolvedValue(1) }
  const config = {
    get: (key: keyof Env) =>
      ({
        ACCOUNT_DELETION_GRACE_DAYS: 15,
        AUTH_RECORD_RETENTION_DAYS: 30,
        STORAGE_ORPHAN_SWEEP_ENABLED: true,
        ...env,
      })[key],
  } as unknown as ConfigService<Env, true>
  const service = new SettingsService(
    db as unknown as Database,
    redis as unknown as Redis,
    config,
  )
  return {
    service,
    state,
    writes,
    redis,
    gate: (promise: Promise<void> | undefined) => {
      selectGate = promise
    },
  }
}

function row(key: string, value: unknown): Row {
  return { key, value, updatedAt: new Date(), updatedBy: ADMIN }
}

async function rejection(promise: Promise<unknown>): Promise<AppException> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(AppException)
  return error as AppException
}

describe('settings catalog', () => {
  it('declares a bounded schema for every numeric setting', () => {
    for (const key of SETTING_KEYS) {
      const schema = z.toJSONSchema(SETTINGS[key].schema)
      if (schema.type === 'integer' || schema.type === 'number') {
        expect(schema, key).toHaveProperty('minimum')
        expect(schema, key).toHaveProperty('maximum')
      }
    }
  })
})

describe('SettingsService', () => {
  it('falls back to env defaults and applies stored overrides', async () => {
    const { service, state } = setup({ ACCOUNT_DELETION_GRACE_DAYS: 7 })
    expect(service.get('account.deletionGraceDays')).toBe(7)
    expect(service.get('auth.registrationEnabled')).toBe(true)

    state.rows = [
      row('account.deletionGraceDays', 3),
      row('auth.registrationEnabled', false),
    ]
    await service.reload()
    expect(service.get('account.deletionGraceDays')).toBe(3)
    expect(service.get('auth.registrationEnabled')).toBe(false)
    // Untouched settings keep their defaults.
    expect(service.get('maintenance.authRecordRetentionDays')).toBe(30)
  })

  it('ignores stored keys it does not know and values outside the schema', async () => {
    const { service, state } = setup()
    state.rows = [
      row('removed.setting', 'anything'),
      row('account.deletionGraceDays', 10_000),
      row('maintenance.storageOrphanSweepEnabled', 'yes'),
    ]
    await service.reload()
    expect(service.get('account.deletionGraceDays')).toBe(15)
    expect(service.get('maintenance.storageOrphanSweepEnabled')).toBe(true)
    expect(service.list().every((view) => !view.overridden)).toBe(true)
  })

  it('keeps the result of the newest load when loads overlap', async () => {
    const { service, state, gate } = setup()
    let release!: () => void
    gate(new Promise((resolve) => (release = resolve)))
    state.rows = [row('account.deletionGraceDays', 1)]
    const older = service.reload()
    gate(undefined)
    state.rows = [row('account.deletionGraceDays', 2)]
    await service.reload()
    release()
    await older
    expect(service.get('account.deletionGraceDays')).toBe(2)
  })

  it('lists effective values with defaults, schema and the last change', async () => {
    const { service, state } = setup()
    state.rows = [row('account.deletionGraceDays', 3)]
    await service.reload()
    const view = service
      .list()
      .find((item) => item.key === 'account.deletionGraceDays')
    expect(view).toMatchObject({
      value: 3,
      defaultValue: 15,
      overridden: true,
      public: false,
      updatedBy: ADMIN,
      schema: { type: 'integer', minimum: 0, maximum: 365 },
    })
    expect(service.list().map((item) => item.key)).toEqual(SETTING_KEYS)
  })

  it('exposes only public settings to clients', () => {
    const { service } = setup()
    expect(service.publicValues()).toEqual({ 'auth.registrationEnabled': true })
  })

  it('writes valid changes, resets null ones and tells the other instances', async () => {
    const { service, state, writes, redis } = setup()
    const views = service.update(
      { 'account.deletionGraceDays': 5, 'auth.registrationEnabled': null },
      ADMIN,
    )
    state.rows = [row('account.deletionGraceDays', 5)]
    await views
    expect(writes).toEqual([
      { values: [], deleted: 1 },
      {
        values: [
          { key: 'account.deletionGraceDays', value: 5, updatedBy: ADMIN },
        ],
        deleted: 0,
      },
    ])
    expect(redis.publish).toHaveBeenCalledWith(SETTINGS_CHANNEL, '1')
    expect(service.get('account.deletionGraceDays')).toBe(5)
  })

  it('rejects unknown keys and invalid values without writing anything', async () => {
    const { service, writes, redis } = setup()
    const unknown = await rejection(
      service.update({ 'account.deletionGraceDays': 5, nope: true }, ADMIN),
    )
    expect(unknown.getResponse()).toMatchObject({
      code: 'SETTING_UNKNOWN',
      params: { key: 'nope' },
    })

    for (const value of [-1, 366, 1.5, '5', true]) {
      const invalid = await rejection(
        service.update({ 'account.deletionGraceDays': value }, ADMIN),
      )
      expect(invalid.getResponse()).toMatchObject({
        statusCode: 400,
        code: 'SETTING_INVALID',
        params: { key: 'account.deletionGraceDays' },
      })
    }
    expect(writes).toEqual([])
    expect(redis.publish).not.toHaveBeenCalled()
  })

  it('treats an empty change as a no-op', async () => {
    const { service, writes, redis } = setup()
    expect(await service.update({}, ADMIN)).toHaveLength(SETTING_KEYS.length)
    expect(writes).toEqual([])
    expect(redis.publish).not.toHaveBeenCalled()
  })
})
