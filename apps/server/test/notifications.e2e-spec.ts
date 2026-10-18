import { NotificationsCleanup } from '../src/modules/maintenance/notifications.cleanup.js'
import { NotificationStreamService } from '../src/modules/notifications/notification-stream.service.js'
import {
  ADMIN_API,
  CLIENT_API,
  cookieValue,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  waitFor,
  type Agent,
  type TestApp,
} from './support/test-app.js'

const BEARER = { 'X-Auth-Transport': 'bearer' }

interface NotificationView {
  id: string
  type: string
  category: string | null
  params: Record<string, unknown>
  title: string
  body: string
  link: string | null
  readAt: string | null
}

interface StreamEvent {
  event: string
  data: unknown
}

/** Reads a `text/event-stream` response with fetch, collecting events as they arrive. */
async function openStream(url: string, headers: Record<string, string>) {
  const controller = new AbortController()
  const response = await fetch(url, { headers, signal: controller.signal })
  const events: StreamEvent[] = []
  const state = { ended: false, raw: '' }
  if (response.ok && response.body) {
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()
    void (async () => {
      let buffer = ''
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }
          state.raw += value
          buffer += value
          for (
            let end = buffer.indexOf('\n\n');
            end >= 0;
            end = buffer.indexOf('\n\n')
          ) {
            const frame = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const fields = Object.fromEntries(
              frame
                .split('\n')
                .filter((line) => !line.startsWith(':'))
                .map((line) => [
                  line.slice(0, line.indexOf(':')),
                  line.slice(line.indexOf(':') + 2),
                ]),
            )
            if (fields.event) {
              events.push({
                event: fields.event,
                data: JSON.parse(fields.data ?? 'null'),
              })
            }
          }
        }
      } catch {
        // Aborted by the test.
      }
      state.ended = true
    })()
  }
  return {
    response,
    events,
    state,
    next: (event: string, after = 0) =>
      waitFor(() => events.slice(after).find((item) => item.event === event)),
    close: () => controller.abort(),
  }
}

describe('notifications and announcements (e2e)', () => {
  let t: TestApp
  /** A second instance on the same database and Redis: events must cross instances. */
  let other: TestApp
  let admin: Agent
  let baseUrl: string

  beforeAll(async () => {
    t = await createTestApp()
    other = await createTestApp({ mailbox: t.mailbox })
    admin = await loginAdmin(t, E2E_ADMIN)
    await t.app.listen(0, '127.0.0.1')
    baseUrl = (await t.app.getUrl()).replace('[::1]', '127.0.0.1')
  })

  afterAll(async () => {
    await other.close()
    // fetch keeps idle keep-alive sockets open, which would hold the listening server for its keepAliveTimeout.
    t.app.getHttpServer().closeAllConnections()
    await t.close()
  })

  async function notifications(agent: Agent, query = '') {
    const response = await agent
      .get(`${CLIENT_API}/notifications${query}`)
      .expect(200)
    return response.body as { items: NotificationView[]; total: number }
  }

  async function changePassword(agent: Agent, from: string, to: string) {
    await agent
      .post(`${CLIENT_API}/users/me/password`)
      .send({ currentPassword: from, newPassword: to })
      .expect(204)
  }

  describe('personal notifications', () => {
    it('stores security notifications next to the email and manages the inbox', async () => {
      const { agent, user, credentials } = await registerUser(t)
      const empty = await agent
        .get(`${CLIENT_API}/notifications/unread-count`)
        .expect(200)
      expect(empty.body).toEqual({
        notifications: 0,
        announcements: 0,
        total: 0,
      })

      await changePassword(agent, credentials.password, 'password456')
      await changePassword(agent, 'password456', 'password789')
      await waitFor(() => t.mailbox.to(user.email).length >= 3)

      const list = await notifications(agent)
      expect(list.total).toBe(2)
      expect(list.items[0]).toMatchObject({
        type: 'security.passwordChanged',
        category: 'security',
        params: {},
        title: 'Your password was changed',
        link: '/account',
        readAt: null,
      })
      const [newest, oldest] = list.items
      const count = await agent
        .get(`${CLIENT_API}/notifications/unread-count`)
        .expect(200)
      expect(count.body).toMatchObject({ notifications: 2, total: 2 })

      // Other accounts and the other realm never see them.
      const stranger = await registerUser(t)
      expect((await notifications(stranger.agent)).total).toBe(0)
      const notFound = await stranger.agent
        .post(`${CLIENT_API}/notifications/${newest!.id}/read`)
        .expect(404)
      expect(notFound.body.code).toBe('NOTIFICATION_NOT_FOUND')
      await stranger.agent
        .delete(`${CLIENT_API}/notifications/${newest!.id}`)
        .expect(404)
      await agent.get(`${ADMIN_API}/notifications`).expect(401)

      await agent
        .post(`${CLIENT_API}/notifications/${newest!.id}/read`)
        .expect(204)
      // Reading twice is fine and keeps the first time.
      await agent
        .post(`${CLIENT_API}/notifications/${newest!.id}/read`)
        .expect(204)
      expect(
        (await notifications(agent, '?unread=true')).items.map(
          (item) => item.id,
        ),
      ).toEqual([oldest!.id])
      await agent.get(`${CLIENT_API}/notifications?unread=maybe`).expect(400)
      expect(
        (await notifications(agent, '?category=knowledgeBase')).total,
      ).toBe(0)

      const all = await agent
        .post(`${CLIENT_API}/notifications/read-all`)
        .expect(200)
      expect(all.body).toEqual({ updated: 1 })
      expect((await notifications(agent, '?unread=true')).total).toBe(0)

      await agent
        .delete(`${CLIENT_API}/notifications/${oldest!.id}`)
        .expect(204)
      expect((await notifications(agent)).total).toBe(1)
    })

    it('notifies admins in their own realm', async () => {
      const { agent, admin: account, credentials } = await createAdmin(t, admin)
      await agent
        .post(`${ADMIN_API}/me/password`)
        .send({
          currentPassword: credentials.password,
          newPassword: 'admin-password-2',
        })
        .expect(204)
      const list = await agent.get(`${ADMIN_API}/notifications`).expect(200)
      expect(list.body.items).toEqual([
        expect.objectContaining({
          type: 'security.passwordChanged',
          link: '/settings/account',
        }),
      ])
      await waitFor(() => t.mailbox.to(account.email).length > 0)
      const preferences = await agent
        .get(`${ADMIN_API}/notifications/preferences`)
        .expect(200)
      expect(preferences.body).toEqual([
        expect.objectContaining({
          category: 'security',
          mandatory: true,
          channels: { inApp: true, email: true },
        }),
      ])
    })

    it('reports document processing in-app and honours preferences', async () => {
      const { agent, user } = await registerUser(t)
      const kb = await agent
        .post(`${CLIENT_API}/rag/knowledge-bases`)
        .send({ name: 'Notes' })
        .expect(201)
      const document = await agent
        .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/text`)
        .send({ title: 'Guide', content: 'Some text to index.' })
        .expect(201)
      const ready = await waitFor(async () => {
        const list = await notifications(agent, '?category=knowledgeBase')
        return list.items[0]
      })
      expect(ready).toMatchObject({
        type: 'knowledgeBase.documentReady',
        params: {
          knowledgeBaseId: kb.body.id,
          documentId: document.body.id,
          title: 'Guide',
          chunkCount: 1,
        },
        title: 'Document ready',
        body: '"Guide" was indexed into 1 chunks and can be searched now.',
        link: null,
      })

      const defaults = await agent
        .get(`${CLIENT_API}/notifications/preferences`)
        .expect(200)
      expect(defaults.body).toEqual([
        expect.objectContaining({
          category: 'security',
          mandatory: true,
          channels: { inApp: true, email: true },
        }),
        expect.objectContaining({
          category: 'account',
          mandatory: false,
          channels: { inApp: true, email: true },
        }),
        expect.objectContaining({
          category: 'knowledgeBase',
          channels: { inApp: true },
        }),
      ])

      for (const [preferences, code] of [
        [{ security: { email: false } }, 'NOTIFICATION_CATEGORY_MANDATORY'],
        [{ billing: { email: false } }, 'NOTIFICATION_CATEGORY_UNKNOWN'],
        [
          { knowledgeBase: { email: false } },
          'NOTIFICATION_PREFERENCE_INVALID',
        ],
        [{ account: { email: 'no' } }, 'NOTIFICATION_PREFERENCE_INVALID'],
        // All or nothing: the valid first entry is not applied either.
        [
          { account: { email: false }, billing: { inApp: false } },
          'NOTIFICATION_CATEGORY_UNKNOWN',
        ],
      ] as const) {
        const rejected = await agent
          .patch(`${CLIENT_API}/notifications/preferences`)
          .send({ preferences })
          .expect(400)
        expect(rejected.body.code).toBe(code)
      }

      const updated = await agent
        .patch(`${CLIENT_API}/notifications/preferences`)
        .send({
          preferences: {
            knowledgeBase: { inApp: false },
            account: { email: false },
            security: { inApp: true },
          },
        })
        .expect(200)
      expect(updated.body).toEqual([
        expect.objectContaining({
          category: 'security',
          channels: { inApp: true, email: true },
        }),
        expect.objectContaining({
          category: 'account',
          channels: { inApp: true, email: false },
        }),
        expect.objectContaining({
          category: 'knowledgeBase',
          channels: { inApp: false },
        }),
      ])
      // Channels merge: switching one keeps the other.
      const merged = await agent
        .patch(`${CLIENT_API}/notifications/preferences`)
        .send({ preferences: { account: { inApp: true } } })
        .expect(200)
      expect(merged.body[1].channels).toEqual({ inApp: true, email: false })

      const second = await agent
        .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/text`)
        .send({ title: 'Quiet', content: 'More text.' })
        .expect(201)
      await waitFor(async () => {
        const response = await agent
          .get(
            `${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/${second.body.id}`,
          )
          .expect(200)
        return response.body.status === 'ready'
      })

      // The export email is off, the in-app notification is not; the export includes the notifications.
      const mailsBefore = t.mailbox.to(user.email).length
      const requested = await agent
        .post(`${CLIENT_API}/users/me/exports`)
        .expect(202)
      const exportReady = await waitFor(async () => {
        const list = await notifications(agent, '?category=account')
        return list.items[0]
      })
      expect(exportReady).toMatchObject({
        type: 'account.exportReady',
        params: { exportId: requested.body.id },
        link: '/account',
      })
      expect(t.mailbox.to(user.email)).toHaveLength(mailsBefore)
      expect(
        (await notifications(agent, '?category=knowledgeBase')).items,
      ).toHaveLength(1)

      const download = await agent
        .get(`${CLIENT_API}/users/me/exports/${requested.body.id}/download`)
        .expect(200)
      expect(download.body.notifications).toEqual([
        expect.objectContaining({ type: 'knowledgeBase.documentReady' }),
      ])
      expect(download.body.notificationPreferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'account',
            channels: { inApp: true, email: false },
          }),
        ]),
      )
    })
  })

  describe('announcements', () => {
    it('needs announcement permissions to manage them', async () => {
      const { agent: noRoles } = await createAdmin(t, admin)
      const denied = await noRoles.get(`${ADMIN_API}/announcements`).expect(403)
      expect(denied.body.code).toBe('PERMISSION_DENIED')
      await noRoles
        .post(`${ADMIN_API}/announcements`)
        .send({ title: 'Hi', body: 'There' })
        .expect(403)
      const { agent: client } = await registerUser(t)
      await client.get(`${ADMIN_API}/announcements`).expect(401)
    })

    it('shows published announcements to their audience until they expire', async () => {
      const { agent: client } = await registerUser(t)
      const { agent: operator } = await createAdmin(t, admin)
      const past = await admin
        .post(`${ADMIN_API}/announcements`)
        .send({
          title: 'Old',
          body: 'Gone',
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        })
        .expect(400)
      expect(past.body.code).toBe('ANNOUNCEMENT_EXPIRY_INVALID')

      const draft = await admin
        .post(`${ADMIN_API}/announcements`)
        .send({
          title: 'Maintenance',
          body: 'Tonight\n22:00',
          level: 'warning',
          audience: 'user',
        })
        .expect(201)
      expect(draft.body).toMatchObject({
        status: 'draft',
        publishedAt: null,
        audience: 'user',
        readCount: 0,
      })
      const adminsOnly = await admin
        .post(`${ADMIN_API}/announcements`)
        .send({
          title: 'Staff',
          body: 'Admins only',
          audience: 'admin',
          publish: true,
        })
        .expect(201)
      expect(adminsOnly.body.status).toBe('published')

      const inbox = async (agent: Agent, api: string) =>
        (await agent.get(`${api}/notifications/announcements`).expect(200))
          .body as { items: { id: string; readAt: string | null }[] }
      const ids = async (agent: Agent, api: string) =>
        (await inbox(agent, api)).items.map((item) => item.id)
      expect(await ids(client, CLIENT_API)).not.toContain(draft.body.id)

      const published = await admin
        .post(`${ADMIN_API}/announcements/${draft.body.id}/publish`)
        .expect(200)
      expect(published.body.status).toBe('published')
      // Publishing again keeps the first publication time.
      const again = await admin
        .post(`${ADMIN_API}/announcements/${draft.body.id}/publish`)
        .expect(200)
      expect(again.body.publishedAt).toBe(published.body.publishedAt)

      const clientIds = await ids(client, CLIENT_API)
      expect(clientIds).toContain(draft.body.id)
      expect(clientIds).not.toContain(adminsOnly.body.id)
      const adminIds = await ids(operator, ADMIN_API)
      expect(adminIds).toContain(adminsOnly.body.id)
      expect(adminIds).not.toContain(draft.body.id)
      const hidden = await client
        .post(
          `${CLIENT_API}/notifications/announcements/${adminsOnly.body.id}/read`,
        )
        .expect(404)
      expect(hidden.body.code).toBe('ANNOUNCEMENT_NOT_FOUND')

      const unread = (
        await client.get(`${CLIENT_API}/notifications/unread-count`).expect(200)
      ).body.announcements as number
      expect(unread).toBeGreaterThan(0)
      await client
        .post(`${CLIENT_API}/notifications/announcements/${draft.body.id}/read`)
        .expect(204)
      await client
        .post(`${CLIENT_API}/notifications/announcements/${draft.body.id}/read`)
        .expect(204)
      expect(
        (await inbox(client, CLIENT_API)).items.find(
          (item) => item.id === draft.body.id,
        )?.readAt,
      ).toEqual(expect.any(String))
      const allRead = await client
        .post(`${CLIENT_API}/notifications/announcements/read-all`)
        .expect(200)
      expect(allRead.body.updated).toBe(unread - 1)
      const after = await client
        .get(`${CLIENT_API}/notifications/unread-count`)
        .expect(200)
      expect(after.body.announcements).toBe(0)

      const detail = await admin
        .get(`${ADMIN_API}/announcements/${draft.body.id}`)
        .expect(200)
      expect(detail.body.readCount).toBe(1)
      const listed = await admin
        .get(`${ADMIN_API}/announcements?status=published&keyword=Mainten`)
        .expect(200)
      expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([
        draft.body.id,
      ])

      // Expired: hidden from the audience, listed as expired, cannot be republished.
      await t.pool.query(
        `update announcements set expires_at = now() - interval '1 second' where id = $1`,
        [draft.body.id],
      )
      expect(await ids(client, CLIENT_API)).not.toContain(draft.body.id)
      const expired = await admin
        .get(`${ADMIN_API}/announcements?status=expired`)
        .expect(200)
      expect(
        expired.body.items.map((item: { id: string }) => item.id),
      ).toContain(draft.body.id)
      await admin
        .post(`${ADMIN_API}/announcements/${draft.body.id}/withdraw`)
        .expect(200)
      const republish = await admin
        .post(`${ADMIN_API}/announcements/${draft.body.id}/publish`)
        .expect(400)
      expect(republish.body.code).toBe('ANNOUNCEMENT_EXPIRY_INVALID')
      const cleared = await admin
        .patch(`${ADMIN_API}/announcements/${draft.body.id}`)
        .send({ expiresAt: null, title: 'Maintenance (moved)' })
        .expect(200)
      expect(cleared.body).toMatchObject({
        status: 'draft',
        expiresAt: null,
        title: 'Maintenance (moved)',
      })

      await admin
        .delete(`${ADMIN_API}/announcements/${draft.body.id}`)
        .expect(204)
      await admin.get(`${ADMIN_API}/announcements/${draft.body.id}`).expect(404)
      await admin
        .delete(`${ADMIN_API}/announcements/${adminsOnly.body.id}`)
        .expect(204)
    })
  })

  describe('event stream', () => {
    it('pushes events across instances to bearer and cookie clients', async () => {
      const { user, credentials } = await registerUser(t)
      const login = await t
        .http()
        .post(`${CLIENT_API}/auth/login`)
        .set(BEARER)
        .send(credentials)
        .expect(200)
      const token = login.body.tokens.accessToken as string
      const auth = { Authorization: `Bearer ${token}` }

      const unauthorized = await fetch(
        `${baseUrl}${CLIENT_API}/notifications/stream`,
      )
      expect(unauthorized.status).toBe(401)
      expect((await unauthorized.json()).code).toBe('AUTH_REQUIRED')

      const stream = await openStream(
        `${baseUrl}${CLIENT_API}/notifications/stream`,
        { ...auth, Origin: 'http://localhost:5174' },
      )
      expect(stream.response.status).toBe(200)
      expect(stream.response.headers.get('content-type')).toBe(
        'text/event-stream; charset=utf-8',
      )
      expect(stream.response.headers.get('access-control-allow-origin')).toBe(
        'http://localhost:5174',
      )
      expect(stream.response.headers.get('x-request-id')).toBeTruthy()
      await stream.next('ready')

      const adminLogin = await t
        .http()
        .post(`${ADMIN_API}/auth/login`)
        .send({ email: E2E_ADMIN.email, password: E2E_ADMIN.password })
        .expect(200)
      const adminCookie = cookieValue(
        adminLogin.headers['set-cookie'],
        'admin_access_token',
      )!
      const adminStream = await openStream(
        `${baseUrl}${ADMIN_API}/notifications/stream`,
        { Cookie: `admin_access_token=${adminCookie}` },
      )
      await adminStream.next('ready')

      // Published through the other instance: reaches the user's stream, not the admin's.
      const otherAdmin = await loginAdmin(other, E2E_ADMIN)
      const announcement = await otherAdmin
        .post(`${ADMIN_API}/announcements`)
        .send({
          title: 'Hello',
          body: 'Users',
          audience: 'user',
          publish: true,
        })
        .expect(201)
      expect(await stream.next('announcement')).toEqual({
        event: 'announcement',
        data: { id: announcement.body.id },
      })

      // A personal notification arrives with its full view.
      const kb = await t
        .http()
        .post(`${CLIENT_API}/rag/knowledge-bases`)
        .set(auth)
        .send({ name: 'Streamed' })
        .expect(201)
      await t
        .http()
        .post(`${CLIENT_API}/rag/knowledge-bases/${kb.body.id}/documents/text`)
        .set(auth)
        .send({ title: 'Live', content: 'Streamed text.' })
        .expect(201)
      const pushed = await stream.next('notification')
      expect(pushed.data).toMatchObject({
        type: 'knowledgeBase.documentReady',
        params: { title: 'Live' },
      })
      const index = stream.events.length
      await t
        .http()
        .post(`${CLIENT_API}/notifications/read-all`)
        .set(auth)
        .expect(200)
      expect((await stream.next('sync', index)).data).toEqual({
        reason: 'read',
      })
      expect(
        adminStream.events.some((item) => item.event === 'announcement'),
      ).toBe(false)

      // Logging out revokes the session; the next sweep ends its stream.
      await t
        .http()
        .post(`${CLIENT_API}/auth/logout`)
        .set({ ...BEARER, ...auth })
        .send({ refreshToken: login.body.tokens.refreshToken })
        .expect(204)
      await t.app.get(NotificationStreamService).sweep()
      await waitFor(() => stream.state.ended)
      expect(adminStream.state.ended).toBe(false)
      await waitFor(() => adminStream.state.raw.includes(': ping'))

      adminStream.close()
      await otherAdmin
        .delete(`${ADMIN_API}/announcements/${announcement.body.id}`)
        .expect(204)
      expect(user.id).toBeTruthy()
    })
  })

  it('prunes notifications older than the retention period', async () => {
    const { agent, credentials } = await registerUser(t)
    await changePassword(agent, credentials.password, 'password456')
    const [{ id }] = (await notifications(agent)).items
    await t.pool.query(
      `update user_notifications set created_at = now() - interval '100 days' where id = $1`,
      [id],
    )
    const deleted = await t.app
      .get(NotificationsCleanup)
      .run(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
    expect(deleted).toBeGreaterThanOrEqual(1)
    expect((await notifications(agent)).total).toBe(0)
  })
})
