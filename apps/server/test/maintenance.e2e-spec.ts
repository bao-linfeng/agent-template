import { randomUUID } from 'node:crypto'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { StorageService } from '../src/infra/storage/storage.service.js'
import { QUEUES } from '../src/infra/queue/queue.module.js'
import { AuthRecordsCleanup } from '../src/modules/maintenance/auth-records.cleanup.js'
import { MAINTENANCE_JOBS } from '../src/modules/maintenance/maintenance.processor.js'
import { OrphanObjectsCleanup } from '../src/modules/maintenance/orphan-objects.cleanup.js'
import {
  CLIENT_API,
  createTestApp,
  E2E_ADMIN,
  registerUser,
  type TestApp,
} from './support/test-app.js'

const DAY_MS = 24 * 60 * 60 * 1000
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
])

describe('maintenance jobs (e2e)', () => {
  let t: TestApp
  let storage: StorageService

  beforeAll(async () => {
    t = await createTestApp()
    storage = t.app.get(StorageService)
  })

  afterAll(async () => {
    await t.close()
  })

  async function keysUnder(prefix: string): Promise<string[]> {
    const keys: string[] = []
    for await (const page of storage.listObjects(prefix)) {
      keys.push(...page.map((item) => item.key))
    }
    return keys
  }

  it('registers the nightly job schedulers', async () => {
    const queue = t.app.get<Queue>(getQueueToken(QUEUES.maintenance))
    const schedulers = await queue.getJobSchedulers()
    expect(schedulers.map((scheduler) => scheduler.key).sort()).toEqual(
      Object.values(MAINTENANCE_JOBS).sort(),
    )
  })

  it('deletes sessions and reset tokens that ended before the cutoff in both realms', async () => {
    const { agent, user } = await registerUser(t)
    const {
      rows: [admin],
    } = await t.pool.query<{ id: string }>(
      'select id from admin_users where email = $1',
      [E2E_ADMIN.email],
    )
    const now = Date.now()
    const old = new Date(now - 40 * DAY_MS)
    const recent = new Date(now - DAY_MS)
    const future = new Date(now + DAY_MS)

    async function insertSessions(table: string, userId: string) {
      const { rows } = await t.pool.query<{ id: string }>(
        `insert into ${table} (user_id, refresh_token_hash, expires_at, revoked_at)
         values ($1, 'x', $2, null), ($1, 'x', $3, $2), ($1, 'x', $4, null), ($1, 'x', $3, $4)
         returning id`,
        [userId, old, future, recent],
      )
      return {
        expiredLongAgo: rows[0]!.id,
        revokedLongAgo: rows[1]!.id,
        expiredRecently: rows[2]!.id,
        revokedRecently: rows[3]!.id,
      }
    }
    async function insertResetTokens(table: string, userId: string) {
      const { rows } = await t.pool.query<{ id: string }>(
        `insert into ${table} (user_id, token_hash, expires_at, used_at)
         values ($1, $5, $2, null), ($1, $6, $3, $2), ($1, $7, $3, null), ($1, $8, $3, $4)
         returning id`,
        [
          userId,
          old,
          future,
          recent,
          ...Array.from({ length: 4 }, () => randomUUID()),
        ],
      )
      return {
        expiredLongAgo: rows[0]!.id,
        usedLongAgo: rows[1]!.id,
        active: rows[2]!.id,
        usedRecently: rows[3]!.id,
      }
    }

    const fixtures = {
      auth_sessions: await insertSessions('auth_sessions', user.id),
      admin_sessions: await insertSessions('admin_sessions', admin!.id),
      password_reset_tokens: await insertResetTokens(
        'password_reset_tokens',
        user.id,
      ),
      admin_password_reset_tokens: await insertResetTokens(
        'admin_password_reset_tokens',
        admin!.id,
      ),
    }

    const deleted = await t.app
      .get(AuthRecordsCleanup)
      .run(new Date(now - 30 * DAY_MS))
    expect(deleted.sessions).toBeGreaterThanOrEqual(4)
    expect(deleted.resetTokens).toBeGreaterThanOrEqual(4)

    for (const [table, ids] of Object.entries(fixtures)) {
      const { rows } = await t.pool.query<{ id: string }>(
        `select id from ${table} where id = any($1::uuid[])`,
        [Object.values(ids)],
      )
      const remaining = new Set(rows.map((row) => row.id))
      for (const [label, id] of Object.entries(ids)) {
        expect(remaining.has(id), `${table}.${label}`).toBe(
          !label.endsWith('LongAgo'),
        )
      }
    }

    // The real session of the signed-in user is untouched.
    await agent.get(`${CLIENT_API}/users/me`).expect(200)
  })

  it('deletes unreferenced avatar and RAG objects older than the cutoff', async () => {
    const { agent, user } = await registerUser(t)
    const uploaded = await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', PNG, 'me.png')
      .expect(200)
    const currentAvatar = `avatars/${new URL(uploaded.body.avatarUrl as string).pathname.split('/avatars/')[1]}`

    const kb = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases`)
      .send({ name: 'Sweep' })
      .expect(201)
    const document = await agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/text`)
      .send({ title: 'Kept', content: 'Still referenced.' })
      .expect(201)
    const {
      rows: [stored],
    } = await t.pool.query<{ storage_key: string }>(
      'select storage_key from rag_documents where id = $1',
      [document.body.id],
    )
    const currentSource = stored!.storage_key

    const orphans = [
      `avatars/${user.id}/${randomUUID()}.png`,
      `avatars/${randomUUID()}/${randomUUID()}.webp`,
      `rag/${kb.body.id}/${randomUUID()}/source.md`,
      `rag/${randomUUID()}/${randomUUID()}/source.txt`,
    ]
    const foreign = [`avatars/${user.id}/notes.txt`, `rag/${kb.body.id}/readme`]
    for (const key of [...orphans, ...foreign]) {
      await storage.putObject(key, PNG, 'application/octet-stream')
    }

    const cleanup = t.app.get(OrphanObjectsCleanup)
    // Fresh objects are inside the grace period.
    expect(await cleanup.run(new Date(Date.now() - 60_000))).toBe(0)

    expect(
      await cleanup.run(new Date(Date.now() + 60_000)),
    ).toBeGreaterThanOrEqual(orphans.length)
    const remaining = new Set([
      ...(await keysUnder('avatars/')),
      ...(await keysUnder('rag/')),
    ])
    for (const key of orphans) {
      expect(remaining.has(key), key).toBe(false)
    }
    for (const key of [currentAvatar, currentSource, ...foreign]) {
      expect(remaining.has(key), key).toBe(true)
    }
  })
})
