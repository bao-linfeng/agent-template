import { AuditService } from '../src/modules/audit/audit.service.js'
import {
  ADMIN_API,
  CLIENT_API,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  uniqueEmail,
  waitFor,
  type Agent,
  type TestApp,
} from './support/test-app.js'

interface AuditLog {
  id: string
  realm: string | null
  actorId: string | null
  actorEmail: string | null
  action: string
  method: string
  route: string
  path: string
  resourceId: string | null
  body: Record<string, unknown> | null
  statusCode: number
  errorCode: string | null
  requestId: string | null
}

describe('audit log (e2e)', () => {
  let t: TestApp
  let admin: Agent
  let adminId: string

  beforeAll(async () => {
    t = await createTestApp()
    admin = await loginAdmin(t, E2E_ADMIN)
    adminId = (await admin.get(`${ADMIN_API}/me`).expect(200)).body.id
  })

  afterAll(async () => {
    await t.close()
  })

  /** Entries matching `query`, waiting for the asynchronous writer. */
  async function auditLogs(
    query: Record<string, string>,
    minCount = 1,
  ): Promise<AuditLog[]> {
    return waitFor(async () => {
      await t.app.get(AuditService).flush()
      const response = await admin
        .get(`${ADMIN_API}/audit-logs`)
        .query({ pageSize: 100, ...query })
        .expect(200)
      const items = response.body.items as AuditLog[]
      return items.length >= minCount ? items : undefined
    })
  }

  it('records admin changes with actor, resource and redacted body', async () => {
    const code = `audit_${Math.random().toString(36).slice(2, 8)}`
    const created = await admin
      .post(`${ADMIN_API}/roles`)
      .send({ code, name: 'Audited', permissions: ['user:read'] })
      .expect(201)
    const roleId = created.body.id as string
    await admin
      .patch(`${ADMIN_API}/roles/${roleId}`)
      .send({ name: 'Audited 2' })
      .expect(200)
    await admin.delete(`${ADMIN_API}/roles/${roleId}`).expect(204)

    const entries = await auditLogs({ resourceId: roleId }, 3)
    expect(entries.map((entry) => entry.action)).toEqual([
      'RolesController.remove',
      'RolesController.update',
      'RolesController.create',
    ])
    expect(entries[2]).toMatchObject({
      realm: 'admin',
      actorId: adminId,
      actorEmail: E2E_ADMIN.email,
      method: 'POST',
      route: '/api/v1/admin/roles',
      statusCode: 201,
      errorCode: null,
      body: { code, name: 'Audited', permissions: ['user:read'] },
    })
    expect(entries[1]).toMatchObject({
      route: '/api/v1/admin/roles/:id',
      path: `/api/v1/admin/roles/${roleId}`,
    })
    expect(entries[0]!.requestId).toBeTruthy()

    const model = await admin
      .post(`${ADMIN_API}/ai/embedding-models`)
      .send({
        name: `audit-${code}`,
        baseUrl: 'http://127.0.0.1:9/v1',
        model: 'fake-1024',
        dimensions: 1024,
        apiKey: 'sk-very-secret',
      })
      .expect(201)
    await admin
      .delete(`${ADMIN_API}/ai/embedding-models/${model.body.id}`)
      .expect(204)
    const [, createModel] = await auditLogs({ resourceId: model.body.id }, 2)
    expect(createModel!.body).toMatchObject({ apiKey: '[redacted]' })
    expect(JSON.stringify(createModel)).not.toContain('sk-very-secret')
  })

  it('records failed and successful sign-ins without passwords', async () => {
    const { credentials, admin: operator } = await createAdmin(t, admin)
    await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401)

    const entries = await auditLogs(
      { action: 'AdminAuthController.login', keyword: credentials.email },
      2,
    )
    const [failed, succeeded] = entries
    expect(failed).toMatchObject({
      realm: 'admin',
      actorId: null,
      actorEmail: credentials.email,
      statusCode: 401,
      errorCode: 'AUTH_INVALID_CREDENTIALS',
      body: { email: credentials.email, password: '[redacted]' },
    })
    expect(succeeded).toMatchObject({
      actorId: operator.id,
      statusCode: 200,
    })
  })

  it('records requests rejected by authentication and permissions', async () => {
    const { agent, admin: operator } = await createAdmin(t, admin)
    await agent
      .post(`${ADMIN_API}/roles`)
      .send({ code: 'nope', name: 'Nope', permissions: [] })
      .expect(403)
    await agent.get(`${ADMIN_API}/audit-logs`).expect(403)
    await t
      .http()
      .patch(`${ADMIN_API}/users/00000000-0000-4000-8000-000000000000`)
      .send({ status: 'disabled' })
      .expect(401)

    const [denied] = await auditLogs({
      actorId: operator.id,
      outcome: 'failure',
    })
    expect(denied).toMatchObject({
      action: 'RolesController.create',
      statusCode: 403,
      errorCode: 'PERMISSION_DENIED',
    })
    const [anonymous] = await auditLogs({
      resourceId: '00000000-0000-4000-8000-000000000000',
    })
    expect(anonymous).toMatchObject({
      actorId: null,
      action: 'AdminUsersController.update',
      statusCode: 401,
      errorCode: 'AUTH_REQUIRED',
    })
  })

  it('records client user actions but not reads or successful refreshes', async () => {
    const email = uniqueEmail('audited')
    const { agent, user } = await registerUser(t, { email })
    await agent.get(`${CLIENT_API}/users/me`).expect(200)
    await agent.post(`${CLIENT_API}/auth/refresh`).expect(204)
    await agent
      .patch(`${CLIENT_API}/users/me`)
      .send({ nickname: 'Renamed' })
      .expect(200)

    const entries = await auditLogs({ realm: 'user', actorId: user.id }, 2)
    expect(entries.map((entry) => entry.action)).toEqual([
      'MeController.update',
      'AuthController.register',
    ])
    expect(entries[1]!.body).toMatchObject({
      email,
      code: '[redacted]',
      password: '[redacted]',
    })
    expect(entries[1]!.resourceId).toBe(user.id)
  })

  it('shares the x-request-id of the response', async () => {
    const generated = await t
      .http()
      .post(`${ADMIN_API}/auth/logout`)
      .expect(204)
    const id = generated.headers['x-request-id'] as string
    expect(id).toMatch(/^[0-9a-f-]{36}$/)

    const traced = await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .set('x-request-id', 'trace-audit-e2e')
      .send({ email: 'nobody@e2e.test', password: 'wrong-password' })
      .expect(401)
    expect(traced.headers['x-request-id']).toBe('trace-audit-e2e')
    const [entry] = await auditLogs({ keyword: 'nobody@e2e.test' })
    expect(entry!.requestId).toBe('trace-audit-e2e')
  })

  it('filters by time range and validates the query', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const response = await admin
      .get(`${ADMIN_API}/audit-logs`)
      .query({ from: future })
      .expect(200)
    expect(response.body).toMatchObject({ items: [], total: 0 })
    await admin
      .get(`${ADMIN_API}/audit-logs`)
      .query({ from: 'yesterday' })
      .expect(400)
    await admin
      .get(`${ADMIN_API}/audit-logs/00000000-0000-4000-8000-000000000000`)
      .expect(404)

    const [latest] = await auditLogs({})
    const detail = await admin
      .get(`${ADMIN_API}/audit-logs/${latest!.id}`)
      .expect(200)
    expect(detail.body).toMatchObject({ id: latest!.id })
  })
})
