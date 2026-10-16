import { SettingsService } from '../src/modules/settings/settings.service.js'
import {
  ADMIN_API,
  CLIENT_API,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  requestRegisterCode,
  uniqueEmail,
  waitFor,
  type Agent,
  type TestApp,
} from './support/test-app.js'

const DAY_MS = 24 * 60 * 60 * 1000

interface SettingView {
  key: string
  value: unknown
  defaultValue: unknown
  overridden: boolean
  public: boolean
  schema: Record<string, unknown>
  updatedBy: string | null
}

describe('runtime settings (e2e)', () => {
  let t: TestApp
  /** A second API instance on the same database and Redis, like a scaled-out deployment. */
  let other: TestApp
  let admin: Agent

  beforeAll(async () => {
    t = await createTestApp()
    other = await createTestApp({ mailbox: t.mailbox })
    admin = await loginAdmin(t, E2E_ADMIN)
  })

  afterAll(async () => {
    // Other files run against the same database and expect the defaults.
    await t.pool.query('delete from system_settings')
    await other.close()
    await t.close()
  })

  async function setting(key: string): Promise<SettingView> {
    const response = await admin.get(`${ADMIN_API}/settings`).expect(200)
    return (response.body as SettingView[]).find((view) => view.key === key)!
  }

  it('is readable with setting:read and writable only with setting:manage', async () => {
    const { agent: client } = await registerUser(t)
    await client.get(`${ADMIN_API}/settings`).expect(401)
    await t.http().get(`${ADMIN_API}/settings`).expect(401)

    const { agent: noRoles } = await createAdmin(t, admin)
    const denied = await noRoles.get(`${ADMIN_API}/settings`).expect(403)
    expect(denied.body.code).toBe('PERMISSION_DENIED')

    const views = (await admin.get(`${ADMIN_API}/settings`).expect(200))
      .body as SettingView[]
    expect(
      views.find((view) => view.key === 'account.deletionGraceDays'),
    ).toMatchObject({
      value: 15,
      defaultValue: 15,
      overridden: false,
      public: false,
      updatedBy: null,
      schema: { type: 'integer', minimum: 0, maximum: 365 },
    })
    // Security switches such as AUDIT_LOG_ENABLED are env-only.
    expect(views.some((view) => view.key.startsWith('audit'))).toBe(false)
  })

  it('rejects unknown keys and invalid values as a whole', async () => {
    const unknown = await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'account.deletionGraceDays': 3, 'no.such': 1 } })
      .expect(400)
    expect(unknown.body).toMatchObject({
      code: 'SETTING_UNKNOWN',
      params: { key: 'no.such' },
    })

    const invalid = await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'account.deletionGraceDays': 1000 } })
      .expect(400)
    expect(invalid.body).toMatchObject({
      code: 'SETTING_INVALID',
      params: { key: 'account.deletionGraceDays' },
    })

    await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ 'account.deletionGraceDays': 3 })
      .expect(400)
    expect((await setting('account.deletionGraceDays')).overridden).toBe(false)
  })

  it('closes registration on every instance without a restart', async () => {
    const email = uniqueEmail()
    // Requested while registration is still open.
    const code = await requestRegisterCode(t, email)

    const updated = await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'auth.registrationEnabled': false } })
      .expect(200)
    expect(
      (updated.body as SettingView[]).find(
        (view) => view.key === 'auth.registrationEnabled',
      ),
    ).toMatchObject({ value: false, overridden: true })

    const publicSettings = await t
      .http()
      .get(`${CLIENT_API}/settings`)
      .expect(200)
    expect(publicSettings.body).toEqual({ 'auth.registrationEnabled': false })

    const closed = await t
      .http()
      .post(`${CLIENT_API}/auth/register/send-code`)
      .send({ email: uniqueEmail() })
      .expect(403)
    expect(closed.body.code).toBe('AUTH_REGISTRATION_DISABLED')
    const withCode = await t
      .http()
      .post(`${CLIENT_API}/auth/register`)
      .send({ email, password: 'password123', nickname: 'Late', code })
      .expect(403)
    expect(withCode.body.code).toBe('AUTH_REGISTRATION_DISABLED')

    // The other instance hears about the change through Redis.
    const otherSettings = other.app.get(SettingsService)
    await waitFor(() => otherSettings.get('auth.registrationEnabled') === false)
    await other
      .http()
      .post(`${CLIENT_API}/auth/register/send-code`)
      .send({ email: uniqueEmail() })
      .expect(403)

    // `null` restores the default (open).
    await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'auth.registrationEnabled': null } })
      .expect(200)
    expect(await setting('auth.registrationEnabled')).toMatchObject({
      value: true,
      overridden: false,
    })
    await waitFor(() => otherSettings.get('auth.registrationEnabled'))
    await registerUser(other)
  })

  it('applies the deletion grace period to new deletion requests', async () => {
    await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'account.deletionGraceDays': 2 } })
      .expect(200)
    const changed = await setting('account.deletionGraceDays')
    expect(changed).toMatchObject({ value: 2, overridden: true })
    expect(changed.updatedBy).toEqual(expect.any(String))

    const { agent, credentials } = await registerUser(t)
    const requested = await agent
      .post(`${CLIENT_API}/users/me/deletion`)
      .send({ password: credentials.password })
      .expect(202)
    const graceMs =
      new Date(requested.body.deletionScheduledAt as string).getTime() -
      Date.now()
    expect(graceMs).toBeGreaterThan(1.9 * DAY_MS)
    expect(graceMs).toBeLessThanOrEqual(2 * DAY_MS)
  })

  it('only tightens env limits: the auth rate limit drops at runtime but cannot exceed env', async () => {
    const envLimit = Number(process.env.AUTH_THROTTLE_LIMIT)
    expect(await setting('rateLimit.authLimit')).toMatchObject({
      value: envLimit,
      schema: { type: 'integer', minimum: 1, maximum: envLimit },
    })
    const above = await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'rateLimit.authLimit': envLimit + 1 } })
      .expect(400)
    expect(above.body).toMatchObject({
      code: 'SETTING_INVALID',
      params: { key: 'rateLimit.authLimit' },
    })

    await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'rateLimit.authLimit': 2 } })
      .expect(200)
    const forgot = () =>
      t
        .http()
        .post(`${CLIENT_API}/auth/forgot-password`)
        .send({ email: 'nobody@e2e.test' })
    await forgot().expect(202)
    await forgot().expect(202)
    await forgot().expect(429)
    // The general limit is untouched.
    await t.http().get(`${CLIENT_API}/settings`).expect(200)

    await admin
      .patch(`${ADMIN_API}/settings`)
      .send({ values: { 'rateLimit.authLimit': null } })
      .expect(200)
  })

  it('applies session lifetimes and verification code settings to new sign-ins and codes', async () => {
    await admin
      .patch(`${ADMIN_API}/settings`)
      .send({
        values: {
          'session.adminTtlSeconds': 3600,
          'session.clientIdleTtlSeconds': 900,
          'auth.emailCodeTtlSeconds': 120,
          'auth.emailCodeResendSeconds': 300,
        },
      })
      .expect(200)

    const adminLogin = await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .send({ email: E2E_ADMIN.email, password: E2E_ADMIN.password })
      .expect(200)
    const refreshCookie = (
      adminLogin.headers['set-cookie'] as unknown as string[]
    ).find((cookie) => cookie.startsWith('admin_refresh_token='))!
    const adminMaxAge = Number(/Max-Age=(\d+)/.exec(refreshCookie)![1])
    expect(adminMaxAge).toBeGreaterThan(3500)
    expect(adminMaxAge).toBeLessThanOrEqual(3600)

    const code = await t
      .http()
      .post(`${CLIENT_API}/auth/register/send-code`)
      .send({ email: uniqueEmail() })
      .expect(202)
    expect(code.body).toEqual({ expiresIn: 120, resendAfter: 300 })

    const { credentials } = await registerUser(t)
    const clientLogin = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .set('X-Auth-Transport', 'bearer')
      .send(credentials)
      .expect(200)
    const refreshExpiresIn = clientLogin.body.tokens.refreshExpiresIn as number
    expect(refreshExpiresIn).toBeGreaterThan(800)
    expect(refreshExpiresIn).toBeLessThanOrEqual(900)
  })
})
