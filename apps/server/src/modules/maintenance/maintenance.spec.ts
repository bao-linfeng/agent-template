import type { Job, Queue } from 'bullmq'
import type { SettingValues } from '../settings/settings.catalog.js'
import type { SettingsService } from '../settings/settings.service.js'
import type { AccountExportsCleanup } from './account-exports.cleanup.js'
import type { AuthRecordsCleanup } from './auth-records.cleanup.js'
import type { DeletedAccountsCleanup } from './deleted-accounts.cleanup.js'
import {
  MAINTENANCE_JOBS,
  MaintenanceProcessor,
} from './maintenance.processor.js'
import {
  parseObjectKey,
  type OrphanObjectsCleanup,
} from './orphan-objects.cleanup.js'

const ACCOUNT = '0f8fad5b-d9cb-469f-a165-70867728950e'
const KB = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const DOC = '9b2c6f3e-1a4d-4b8e-8f1c-2d3e4f5a6b7c'
const FILE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

describe('parseObjectKey', () => {
  it('recognises avatar, RAG source and data export keys', () => {
    expect(parseObjectKey(`avatars/${ACCOUNT}/${FILE}.png`)).toEqual({
      kind: 'avatar',
      accountId: ACCOUNT,
    })
    expect(parseObjectKey(`rag/${KB}/${DOC}/source.md`)).toEqual({
      kind: 'rag-source',
      documentId: DOC,
    })
    expect(parseObjectKey(`exports/${ACCOUNT}/${FILE}.json`)).toEqual({
      kind: 'account-export',
      exportId: FILE,
    })
  })

  it('ignores keys the server does not generate', () => {
    for (const key of [
      'avatars/',
      `avatars/${ACCOUNT}/me.png`,
      `avatars/${ACCOUNT}/nested/${FILE}.png`,
      `avatars/not-a-uuid/${FILE}.png`,
      `rag/${KB}/`,
      `rag/${KB}/${DOC}/other.md`,
      `rag/${KB}/${DOC}/source.md/extra`,
      `exports/${ACCOUNT}/${FILE}.png`,
      `exports/${ACCOUNT}/${FILE}.json/extra`,
      `exports/not-a-uuid/${FILE}.json`,
    ]) {
      expect(parseObjectKey(key)).toBeUndefined()
    }
  })
})

describe('MaintenanceProcessor', () => {
  function setup(values: Partial<SettingValues>) {
    const queue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
      removeJobScheduler: vi.fn().mockResolvedValue(true),
    }
    const authRecords = {
      run: vi.fn().mockResolvedValue({ sessions: 0, resetTokens: 0 }),
    }
    const orphanObjects = { run: vi.fn().mockResolvedValue(0) }
    const deletedAccounts = { run: vi.fn().mockResolvedValue(0) }
    const accountExports = { run: vi.fn().mockResolvedValue(0) }
    // Mutable so a test can switch a setting between runs, like an administrator would.
    const settings = {
      values,
      get: (key: keyof SettingValues) => settings.values[key],
    }
    const processor = new MaintenanceProcessor(
      authRecords as unknown as AuthRecordsCleanup,
      orphanObjects as unknown as OrphanObjectsCleanup,
      deletedAccounts as unknown as DeletedAccountsCleanup,
      accountExports as unknown as AccountExportsCleanup,
      queue as unknown as Queue,
      settings as unknown as SettingsService,
    )
    return {
      processor,
      settings,
      queue,
      authRecords,
      orphanObjects,
      deletedAccounts,
      accountExports,
    }
  }

  it('keeps every nightly task scheduled, even when its setting is off', async () => {
    const { processor, queue } = setup({
      'maintenance.authRecordRetentionDays': 0,
      'maintenance.storageOrphanSweepEnabled': false,
    })
    await processor.onApplicationBootstrap()
    for (const [id, pattern] of [
      [MAINTENANCE_JOBS.accountExportsPrune, '15 3 * * *'],
      [MAINTENANCE_JOBS.authRecordsPrune, '30 3 * * *'],
      [MAINTENANCE_JOBS.accountPurge, '45 3 * * *'],
      [MAINTENANCE_JOBS.storageOrphanSweep, '0 4 * * *'],
    ]) {
      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        id,
        { pattern },
        { name: id },
      )
    }
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(4)
    expect(queue.removeJobScheduler).not.toHaveBeenCalled()
  })

  it('dispatches jobs by name with retention-based cutoffs', async () => {
    const {
      processor,
      authRecords,
      orphanObjects,
      deletedAccounts,
      accountExports,
    } = setup({
      'maintenance.authRecordRetentionDays': 7,
      'maintenance.storageOrphanSweepEnabled': true,
    })
    // Frozen clock: cutoffs are exact instead of racing the millisecond tick.
    const now = new Date('2026-10-16T03:30:00.000Z').getTime()
    vi.useFakeTimers({ now, toFake: ['Date'] })
    try {
      await processor.process({
        name: MAINTENANCE_JOBS.authRecordsPrune,
      } as Job)
      expect(authRecords.run).toHaveBeenCalledWith(
        new Date(now - 7 * 24 * 60 * 60 * 1000),
      )

      await processor.process({
        name: MAINTENANCE_JOBS.storageOrphanSweep,
      } as Job)
      expect(orphanObjects.run).toHaveBeenCalledWith(
        new Date(now - 24 * 60 * 60 * 1000),
      )

      for (const [name, cleanup] of [
        [MAINTENANCE_JOBS.accountPurge, deletedAccounts],
        [MAINTENANCE_JOBS.accountExportsPrune, accountExports],
      ] as const) {
        await processor.process({ name } as Job)
        expect(cleanup.run).toHaveBeenCalledWith(new Date(now))
      }
    } finally {
      vi.useRealTimers()
    }

    await expect(processor.process({ name: 'unknown' } as Job)).rejects.toThrow(
      'Unknown maintenance job',
    )
  })

  it('reads the settings when a job runs, so switching them needs no restart', async () => {
    const { processor, settings, authRecords, orphanObjects } = setup({
      'maintenance.authRecordRetentionDays': 0,
      'maintenance.storageOrphanSweepEnabled': false,
    })
    await processor.process({ name: MAINTENANCE_JOBS.authRecordsPrune } as Job)
    await processor.process({
      name: MAINTENANCE_JOBS.storageOrphanSweep,
    } as Job)
    expect(authRecords.run).not.toHaveBeenCalled()
    expect(orphanObjects.run).not.toHaveBeenCalled()

    settings.values = {
      'maintenance.authRecordRetentionDays': 30,
      'maintenance.storageOrphanSweepEnabled': true,
    }
    await processor.process({ name: MAINTENANCE_JOBS.authRecordsPrune } as Job)
    await processor.process({
      name: MAINTENANCE_JOBS.storageOrphanSweep,
    } as Job)
    expect(authRecords.run).toHaveBeenCalledTimes(1)
    expect(orphanObjects.run).toHaveBeenCalledTimes(1)
  })
})
