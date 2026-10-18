import type { ConfigService } from '@nestjs/config'
import type { Job } from 'bullmq'
import type { Env } from '../../config/env.js'
import type { Database } from '../../database/database.js'
import type { StorageService } from '../../infra/storage/storage.service.js'
import type { NotificationsService } from '../notifications/notifications.service.js'
import type { AccountExportBuilder } from './account-export.builder.js'
import { AccountExportProcessor } from './account-export.processor.js'
import type { AccountExportJob } from './account-exports.service.js'

/** Just enough of Drizzle for the processor: one select chain and recorded updates. */
function fakeDb(row: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = []
  const select = {
    from: () => select,
    innerJoin: () => select,
    where: () => select,
    limit: () => Promise.resolve([row]),
  }
  const db = {
    select: () => select,
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values)
        return { where: () => Promise.resolve() }
      },
    }),
  }
  return { db: db as unknown as Database, updates }
}

function setup(notify: NotificationsService['notify']) {
  const { db, updates } = fakeDb({
    userId: 'user-1',
    status: 'pending',
    email: 'ada@example.test',
    nickname: 'Ada',
  })
  const processor = new AccountExportProcessor(
    db,
    {
      write: vi.fn().mockResolvedValue(undefined),
    } as unknown as AccountExportBuilder,
    { putFile: vi.fn().mockResolvedValue(42) } as unknown as StorageService,
    { notify } as unknown as NotificationsService,
    { get: () => 72 } as unknown as ConfigService<Env, true>,
  )
  const job = {
    data: { exportId: 'export-1' },
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as unknown as Job<AccountExportJob>
  return { processor, job, updates }
}

describe('AccountExportProcessor', () => {
  it('marks the export ready and notifies the user', async () => {
    const notify = vi.fn().mockResolvedValue(undefined)
    const { processor, job, updates } = setup(notify)

    await processor.process(job)
    expect(updates.at(-1)).toMatchObject({ status: 'ready', sizeBytes: 42 })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'account.exportReady',
        recipientId: 'user-1',
      }),
    )
  })

  it('keeps a finished export ready when the notification fails', async () => {
    const notify = vi.fn().mockRejectedValue(new Error('Redis is down'))
    const { processor, job, updates } = setup(notify)

    // Not rethrown: BullMQ would retry and build the export again.
    await expect(processor.process(job)).resolves.toBeUndefined()
    expect(updates.map((values) => values.status)).toEqual([
      'processing',
      'ready',
    ])
  })
})
