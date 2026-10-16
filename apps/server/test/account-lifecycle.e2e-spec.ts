import type { Redis } from 'ioredis'
import { REDIS } from '../src/infra/redis/redis.module.js'
import { StorageService } from '../src/infra/storage/storage.service.js'
import { AuditService } from '../src/modules/audit/audit.service.js'
import { AccountExportsCleanup } from '../src/modules/maintenance/account-exports.cleanup.js'
import { DeletedAccountsCleanup } from '../src/modules/maintenance/deleted-accounts.cleanup.js'
import {
  ADMIN_API,
  CLIENT_API,
  cookieValue,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  requestRegisterCode,
  waitFor,
  type Agent,
  type TestApp,
} from './support/test-app.js'

const DAY_MS = 24 * 60 * 60 * 1000
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
])

describe('account deletion and data export (e2e)', () => {
  let t: TestApp
  let storage: StorageService
  let admin: Agent

  beforeAll(async () => {
    t = await createTestApp()
    storage = t.app.get(StorageService)
    admin = await loginAdmin(t, E2E_ADMIN)
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

  /** A user with an avatar and a knowledge base holding one indexed text document. */
  async function userWithData() {
    const registered = await registerUser(t)
    await registered.agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', PNG, 'me.png')
      .expect(200)
    const kb = await registered.agent
      .post(`${CLIENT_API}/rag/knowledge-bases`)
      .send({ name: 'Personal notes' })
      .expect(201)
    const document = await registered.agent
      .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/text`)
      .send({ title: 'Diary', content: 'Line one.\nLine two "quoted".' })
      .expect(201)
    await waitFor(async () => {
      const response = await registered.agent
        .get(
          `${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/${document.body.id}`,
        )
        .expect(200)
      return response.body.status === 'ready'
    })
    return {
      ...registered,
      kbId: kb.body.id as string,
      documentId: document.body.id as string,
    }
  }

  async function exportUntilReady(agent: Agent): Promise<string> {
    const requested = await agent
      .post(`${CLIENT_API}/users/me/exports`)
      .expect(202)
    expect(requested.body).toMatchObject({ status: 'pending', expiresAt: null })
    const id = requested.body.id as string
    await waitFor(async () => {
      const response = await agent
        .get(`${CLIENT_API}/users/me/exports/${id}`)
        .expect(200)
      expect(response.body.status).not.toBe('failed')
      return response.body.status === 'ready'
    })
    return id
  }

  /** Waits until the asynchronous audit writer stored a row matching `where`. */
  async function auditRow(where: string, params: unknown[]): Promise<void> {
    await waitFor(async () => {
      await t.app.get(AuditService).flush()
      const { rowCount } = await t.pool.query(
        `select 1 from audit_logs where ${where}`,
        params,
      )
      return (rowCount ?? 0) > 0
    })
  }

  describe('data export', () => {
    it('exports profile, avatar, sessions, documents and audit trail as JSON', async () => {
      const { agent, user, kbId, documentId } = await userWithData()
      await auditRow(`actor_id = $1 and action = 'RagController.create'`, [
        user.id,
      ])
      const id = await exportUntilReady(agent)

      const view = await agent
        .get(`${CLIENT_API}/users/me/exports/${id}`)
        .expect(200)
      expect(view.body.sizeBytes).toBeGreaterThan(0)
      expect(
        new Date(view.body.expiresAt as string).getTime() - Date.now(),
      ).toBeGreaterThan(71 * 60 * 60 * 1000)

      const download = await agent
        .get(`${CLIENT_API}/users/me/exports/${id}/download`)
        .expect(200)
      expect(download.headers['content-disposition']).toMatch(
        /^attachment; filename="account-export-\d{4}-\d{2}-\d{2}\.json"$/,
      )
      expect(download.headers['cache-control']).toBe('private, no-store')
      const data = download.body as Record<string, any>
      expect(data).toMatchObject({
        format: 'agent-template/account-export',
        version: 1,
        account: { id: user.id, email: user.email, nickname: 'Tester' },
        avatar: { mimeType: 'image/png', base64: PNG.toString('base64') },
        knowledgeBases: [{ id: kbId, name: 'Personal notes' }],
        documents: [
          {
            id: documentId,
            knowledgeBaseId: kbId,
            title: 'Diary',
            content: 'Line one.\nLine two "quoted".',
          },
        ],
      })
      expect(data.sessions.length).toBeGreaterThanOrEqual(1)
      expect(
        (data.auditLogs as { action: string }[]).map((row) => row.action),
      ).toContain('RagController.create')
      const text = JSON.stringify(data)
      expect(text).not.toMatch(/passwordHash|password_hash|refreshTokenHash/)

      expect(
        t.mailbox
          .to(user.email)
          .some((mail) => mail.subject.includes('数据导出')),
      ).toBe(true)

      const list = await agent.get(`${CLIENT_API}/users/me/exports`).expect(200)
      expect(list.body).toMatchObject({ total: 1, page: 1 })
      expect(list.body.items[0].id).toBe(id)

      // Other users cannot see or download it.
      const other = await registerUser(t)
      for (const path of [id, `${id}/download`]) {
        const response = await other.agent
          .get(`${CLIENT_API}/users/me/exports/${path}`)
          .expect(404)
        expect(response.body.code).toBe('ACCOUNT_EXPORT_NOT_FOUND')
      }
    })

    it('allows one export in progress per user and refuses unfinished downloads', async () => {
      const { agent, user } = await registerUser(t)
      const {
        rows: [pending],
      } = await t.pool.query<{ id: string }>(
        'insert into account_exports (user_id) values ($1) returning id',
        [user.id],
      )
      const busy = await agent
        .post(`${CLIENT_API}/users/me/exports`)
        .expect(409)
      expect(busy.body.code).toBe('ACCOUNT_EXPORT_IN_PROGRESS')
      const notReady = await agent
        .get(`${CLIENT_API}/users/me/exports/${pending!.id}/download`)
        .expect(409)
      expect(notReady.body.code).toBe('ACCOUNT_EXPORT_NOT_READY')
    })

    it('stops serving expired exports and prunes them with their files', async () => {
      const { agent, user } = await registerUser(t)
      const id = await exportUntilReady(agent)
      const key = `exports/${user.id}/${id}.json`
      expect(await keysUnder(`exports/${user.id}/`)).toEqual([key])

      await t.pool.query(
        `update account_exports set expires_at = now() - interval '1 minute' where id = $1`,
        [id],
      )
      const expired = await agent
        .get(`${CLIENT_API}/users/me/exports/${id}/download`)
        .expect(410)
      expect(expired.body.code).toBe('ACCOUNT_EXPORT_EXPIRED')

      // A stale unfinished export (lost job) is pruned too, a fresh one is kept.
      const other = await registerUser(t)
      const {
        rows: [stale],
      } = await t.pool.query<{ id: string }>(
        `insert into account_exports (user_id, created_at) values ($1, now() - interval '2 days') returning id`,
        [other.user.id],
      )

      expect(
        await t.app.get(AccountExportsCleanup).run(new Date()),
      ).toBeGreaterThanOrEqual(2)
      const { rows } = await t.pool.query(
        'select id from account_exports where id = any($1::uuid[])',
        [[id, stale!.id]],
      )
      expect(rows).toEqual([])
      expect(await keysUnder(`exports/${user.id}/`)).toEqual([])
      await other.agent.post(`${CLIENT_API}/users/me/exports`).expect(202)
    })
  })

  describe('deletion', () => {
    it('signs the user out, blocks sign-in and can be restored with the password', async () => {
      const { agent, credentials, user } = await registerUser(t)

      const wrong = await agent
        .post(`${CLIENT_API}/users/me/deletion`)
        .send({ password: 'not-the-password' })
        .expect(400)
      expect(wrong.body.code).toBe('ACCOUNT_PASSWORD_INCORRECT')

      const requested = await agent
        .post(`${CLIENT_API}/users/me/deletion`)
        .send({ password: credentials.password })
        .expect(202)
      const scheduledAt = new Date(requested.body.deletionScheduledAt as string)
      expect(scheduledAt.getTime() - Date.now()).toBeGreaterThan(14.9 * DAY_MS)
      expect(cookieValue(requested.headers['set-cookie'], 'access_token')).toBe(
        '',
      )
      await agent.get(`${CLIENT_API}/users/me`).expect(401)
      expect(
        t.mailbox
          .to(user.email)
          .some((mail) => mail.subject.includes('注销申请')),
      ).toBe(true)

      // The pending state is only revealed to someone who knows the password.
      await t
        .http()
        .post(`${CLIENT_API}/auth/login`)
        .send({ email: credentials.email, password: 'not-the-password' })
        .expect(401)
      const blocked = await t
        .http()
        .post(`${CLIENT_API}/auth/login`)
        .send(credentials)
        .expect(403)
      expect(blocked.body).toMatchObject({
        code: 'AUTH_ACCOUNT_PENDING_DELETION',
        params: { scheduledAt: scheduledAt.toISOString() },
      })
      // The email stays reserved during the grace period.
      await t
        .http()
        .post(`${CLIENT_API}/auth/register/send-code`)
        .send({ email: credentials.email })
        .expect(409)

      await t
        .http()
        .post(`${CLIENT_API}/auth/restore`)
        .send({ email: credentials.email, password: 'not-the-password' })
        .expect(401)
      const restoredAgent = t.agent()
      const restored = await restoredAgent
        .post(`${CLIENT_API}/auth/restore`)
        .send(credentials)
        .expect(200)
      expect(restored.body).toMatchObject({
        id: user.id,
        deletionScheduledAt: null,
      })
      await restoredAgent.get(`${CLIENT_API}/users/me`).expect(200)
      await t
        .http()
        .post(`${CLIENT_API}/auth/login`)
        .send(credentials)
        .expect(200)
      expect(
        t.mailbox
          .to(user.email)
          .some((mail) => mail.subject.includes('已撤销')),
      ).toBe(true)
    })

    it('restores through the bearer transport for native clients', async () => {
      const { agent, credentials } = await registerUser(t)
      await agent
        .post(`${CLIENT_API}/users/me/deletion`)
        .send({ password: credentials.password })
        .expect(202)
      const restored = await t
        .http()
        .post(`${CLIENT_API}/auth/restore`)
        .set('X-Auth-Transport', 'bearer')
        .send(credentials)
        .expect(200)
      expect(restored.body.tokens.tokenType).toBe('Bearer')
      await t
        .http()
        .get(`${CLIENT_API}/users/me`)
        .set('Authorization', `Bearer ${restored.body.tokens.accessToken}`)
        .expect(200)
    })

    it('lets administrators with user:delete schedule and cancel deletions', async () => {
      const { agent, user, credentials } = await registerUser(t)
      const operator = await createAdmin(t, admin)
      await operator.agent
        .post(`${ADMIN_API}/users/${user.id}/deletion`)
        .expect(403)

      const scheduled = await admin
        .post(`${ADMIN_API}/users/${user.id}/deletion`)
        .expect(201)
      expect(scheduled.body.deletionScheduledAt).not.toBeNull()
      await agent.get(`${CLIENT_API}/users/me`).expect(401)
      // Repeating keeps the first schedule.
      const again = await admin
        .post(`${ADMIN_API}/users/${user.id}/deletion`)
        .expect(201)
      expect(again.body.deletionScheduledAt).toBe(
        scheduled.body.deletionScheduledAt,
      )

      const pending = await admin
        .get(`${ADMIN_API}/users`)
        .query({ deletion: 'pending', keyword: user.email })
        .expect(200)
      expect(pending.body.items.map((item: { id: string }) => item.id)).toEqual(
        [user.id],
      )
      const live = await admin
        .get(`${ADMIN_API}/users`)
        .query({ deletion: 'none', keyword: user.email })
        .expect(200)
      expect(live.body.total).toBe(0)

      const cancelled = await admin
        .delete(`${ADMIN_API}/users/${user.id}/deletion`)
        .expect(200)
      expect(cancelled.body.deletionScheduledAt).toBeNull()
      await t
        .http()
        .post(`${CLIENT_API}/auth/login`)
        .send(credentials)
        .expect(200)
    })

    it('purges the account and its data after the grace period', async () => {
      const { agent, credentials, user, kbId } = await userWithData()
      await exportUntilReady(agent)
      // An admin edit and an anonymous request that carry the user's data.
      await admin
        .patch(`${ADMIN_API}/users/${user.id}`)
        .send({ nickname: 'Renamed' })
        .expect(200)
      await t
        .http()
        .post(`${CLIENT_API}/auth/login`)
        .send({ email: credentials.email, password: 'not-the-password' })
        .expect(401)
      await agent
        .post(`${CLIENT_API}/users/me/deletion`)
        .send({ password: credentials.password })
        .expect(202)

      await t.pool.query(
        `update users set deletion_scheduled_at = now() - interval '1 minute' where id = $1`,
        [user.id],
      )
      // The grace period is over: the deletion can no longer be undone.
      const late = await t
        .http()
        .post(`${CLIENT_API}/auth/restore`)
        .send(credentials)
        .expect(409)
      expect(late.body.code).toBe('ACCOUNT_DELETION_NOT_CANCELLABLE')
      const lateAdmin = await admin
        .delete(`${ADMIN_API}/users/${user.id}/deletion`)
        .expect(409)
      expect(lateAdmin.body.code).toBe('ACCOUNT_DELETION_NOT_CANCELLABLE')

      // Every request above must be stored before the purge scrubs it.
      await auditRow(
        `action = 'AuthController.restore' and body->>'email' = $1`,
        [credentials.email],
      )
      await auditRow(
        `action = 'AdminUsersController.cancelDeletion' and resource_id = $1`,
        [user.id],
      )
      // Unrelated rows mentioning a different address stay untouched.
      const bystander = await registerUser(t)
      await auditRow(`actor_id = $1`, [bystander.user.id])

      const before = new Date()
      expect(
        await t.app.get(DeletedAccountsCleanup).run(before),
      ).toBeGreaterThanOrEqual(1)

      const { rows: remainingUsers } = await t.pool.query(
        'select id from users where id = $1',
        [user.id],
      )
      expect(remainingUsers).toEqual([])
      for (const [table, column, id] of [
        ['rag_knowledge_bases', 'id', kbId],
        ['rag_chunks', 'knowledge_base_id', kbId],
        ['auth_sessions', 'user_id', user.id],
        ['account_exports', 'user_id', user.id],
      ] as const) {
        const { rowCount } = await t.pool.query(
          `select 1 from ${table} where ${column} = $1`,
          [id],
        )
        expect(rowCount, table).toBe(0)
      }
      for (const prefix of [
        `avatars/${user.id}/`,
        `exports/${user.id}/`,
        `rag/${kbId}/`,
      ]) {
        expect(await keysUnder(prefix), prefix).toEqual([])
      }

      // Audit rows survive without the email or request bodies.
      const { rows: ownRows } = await t.pool.query<{
        actor_email: string | null
        body: unknown
      }>(
        `select actor_email, body from audit_logs where realm = 'user' and actor_id = $1`,
        [user.id],
      )
      expect(ownRows.length).toBeGreaterThan(0)
      expect(
        ownRows.every((row) => row.actor_email === null && row.body === null),
      ).toBe(true)
      const { rowCount: mentions } = await t.pool.query(
        `select 1 from audit_logs
         where (actor_email = $1 or body->>'email' = $1 or resource_id = $2)
           and (actor_email is not null or body is not null)`,
        [credentials.email, user.id],
      )
      expect(mentions).toBe(0)
      const { rows: bystanderRows } = await t.pool.query<{
        actor_email: string | null
      }>(`select actor_email from audit_logs where actor_id = $1`, [
        bystander.user.id,
      ])
      expect(
        bystanderRows.some((row) => row.actor_email === bystander.user.email),
      ).toBe(true)

      expect(
        t.mailbox
          .to(user.email)
          .some((mail) => mail.subject.includes('已注销')),
      ).toBe(true)

      // The email can be registered again (after the code resend cooldown of the first registration).
      const redis = t.app.get<Redis>(REDIS)
      await redis.del(...(await redis.keys('*:cooldown')))
      const code = await requestRegisterCode(t, credentials.email)
      await t
        .http()
        .post(`${CLIENT_API}/auth/register`)
        .send({ ...credentials, nickname: 'Again', code })
        .expect(201)
    })

    it('leaves accounts inside their grace period alone', async () => {
      const { agent, credentials, user } = await registerUser(t)
      await agent
        .post(`${CLIENT_API}/users/me/deletion`)
        .send({ password: credentials.password })
        .expect(202)
      await t.app.get(DeletedAccountsCleanup).run(new Date())
      const { rowCount } = await t.pool.query(
        'select 1 from users where id = $1',
        [user.id],
      )
      expect(rowCount).toBe(1)
    })
  })
})
