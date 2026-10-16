import type { ConfigService } from '@nestjs/config'
import type { Job, Queue } from 'bullmq'
import type { Env } from '../../config/env.js'
import type { AuthRecordsCleanup } from './auth-records.cleanup.js'
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
  it('recognises avatar and RAG source keys', () => {
    expect(parseObjectKey(`avatars/${ACCOUNT}/${FILE}.png`)).toEqual({
      kind: 'avatar',
      accountId: ACCOUNT,
    })
    expect(parseObjectKey(`rag/${KB}/${DOC}/source.md`)).toEqual({
      kind: 'rag-source',
      documentId: DOC,
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
    ]) {
      expect(parseObjectKey(key)).toBeUndefined()
    }
  })
})

describe('MaintenanceProcessor', () => {
  function setup(env: Partial<Env>) {
    const queue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
      removeJobScheduler: vi.fn().mockResolvedValue(true),
    }
    const authRecords = {
      run: vi.fn().mockResolvedValue({ sessions: 0, resetTokens: 0 }),
    }
    const orphanObjects = { run: vi.fn().mockResolvedValue(0) }
    const config = {
      get: (key: keyof Env) => env[key],
    } as unknown as ConfigService<Env, true>
    const processor = new MaintenanceProcessor(
      authRecords as unknown as AuthRecordsCleanup,
      orphanObjects as unknown as OrphanObjectsCleanup,
      queue as unknown as Queue,
      config,
    )
    return { processor, queue, authRecords, orphanObjects }
  }

  it('schedules enabled tasks and unschedules disabled ones', async () => {
    const enabled = setup({
      AUTH_RECORD_RETENTION_DAYS: 30,
      STORAGE_ORPHAN_SWEEP_ENABLED: true,
    })
    await enabled.processor.onApplicationBootstrap()
    expect(enabled.queue.upsertJobScheduler).toHaveBeenCalledWith(
      MAINTENANCE_JOBS.authRecordsPrune,
      { pattern: '30 3 * * *' },
      { name: MAINTENANCE_JOBS.authRecordsPrune },
    )
    expect(enabled.queue.upsertJobScheduler).toHaveBeenCalledWith(
      MAINTENANCE_JOBS.storageOrphanSweep,
      { pattern: '0 4 * * *' },
      { name: MAINTENANCE_JOBS.storageOrphanSweep },
    )
    expect(enabled.queue.removeJobScheduler).not.toHaveBeenCalled()

    const disabled = setup({
      AUTH_RECORD_RETENTION_DAYS: 0,
      STORAGE_ORPHAN_SWEEP_ENABLED: false,
    })
    await disabled.processor.onApplicationBootstrap()
    expect(disabled.queue.upsertJobScheduler).not.toHaveBeenCalled()
    expect(disabled.queue.removeJobScheduler).toHaveBeenCalledWith(
      MAINTENANCE_JOBS.authRecordsPrune,
    )
    expect(disabled.queue.removeJobScheduler).toHaveBeenCalledWith(
      MAINTENANCE_JOBS.storageOrphanSweep,
    )
  })

  it('dispatches jobs by name with retention-based cutoffs', async () => {
    const { processor, authRecords, orphanObjects } = setup({
      AUTH_RECORD_RETENTION_DAYS: 7,
      STORAGE_ORPHAN_SWEEP_ENABLED: true,
    })
    const now = Date.now()

    await processor.process({
      name: MAINTENANCE_JOBS.authRecordsPrune,
    } as Job)
    const authCutoff = (authRecords.run.mock.calls[0] as [Date])[0].getTime()
    expect(now - authCutoff).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000)
    expect(now - authCutoff).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 5_000)

    await processor.process({
      name: MAINTENANCE_JOBS.storageOrphanSweep,
    } as Job)
    const sweepCutoff = (orphanObjects.run.mock.calls[0] as [Date])[0].getTime()
    expect(now - sweepCutoff).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000)

    await expect(processor.process({ name: 'unknown' } as Job)).rejects.toThrow(
      'Unknown maintenance job',
    )
  })

  it('skips disabled tasks even when a stale schedule fires', async () => {
    const { processor, authRecords, orphanObjects } = setup({
      AUTH_RECORD_RETENTION_DAYS: 0,
      STORAGE_ORPHAN_SWEEP_ENABLED: false,
    })
    await processor.process({ name: MAINTENANCE_JOBS.authRecordsPrune } as Job)
    await processor.process({
      name: MAINTENANCE_JOBS.storageOrphanSweep,
    } as Job)
    expect(authRecords.run).not.toHaveBeenCalled()
    expect(orphanObjects.run).not.toHaveBeenCalled()
  })
})
