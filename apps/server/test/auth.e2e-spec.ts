import {
  ADMIN_API,
  API,
  CLIENT_API,
  cookieValue,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  uniqueEmail,
  waitFor,
  type TestApp,
} from './support/test-app.js'

const ADMIN_LOGIN = { email: E2E_ADMIN.email, password: E2E_ADMIN.password }

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
])

describe('auth & account (e2e)', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(async () => {
    await t.close()
  })

  it('registers a client user without roles, sets HttpOnly cookies and rejects duplicates', async () => {
    const email = uniqueEmail('Reg')
    const response = await t
      .http()
      .post(`${CLIENT_API}/auth/register`)
      .send({
        email: email.toUpperCase(),
        password: 'password123',
        nickname: 'Reg',
      })
      .expect(201)

    expect(response.body).toMatchObject({
      email: email.toLowerCase(),
      nickname: 'Reg',
      avatarUrl: null,
    })
    expect(response.body).not.toHaveProperty('passwordHash')
    expect(response.body).not.toHaveProperty('roles')
    expect(response.body).not.toHaveProperty('permissions')
    const cookies = response.headers['set-cookie'] as unknown as string[]
    expect(cookies.find((c) => c.startsWith('access_token='))).toMatch(
      /Path=\/api\/v1\/client;.*HttpOnly/,
    )
    expect(cookies.find((c) => c.startsWith('refresh_token='))).toMatch(
      /Path=\/api\/v1\/client\/auth/,
    )

    await t
      .http()
      .post(`${CLIENT_API}/auth/register`)
      .send({ email, password: 'password123', nickname: 'Dup' })
      .expect(409)
  })

  it('validates input and rejects unknown fields', async () => {
    await t
      .http()
      .post(`${CLIENT_API}/auth/register`)
      .send({ email: 'nope', password: 'short', nickname: 'A' })
      .expect(400)
    await t
      .http()
      .post(`${CLIENT_API}/auth/register`)
      .send({
        email: uniqueEmail(),
        password: 'password123',
        nickname: 'Ok',
        isAdmin: true,
      })
      .expect(400)
  })

  it('requires authentication by default and serves the profile with a session', async () => {
    await t.http().get(`${CLIENT_API}/users/me`).expect(401)
    const { agent, credentials } = await registerUser(t)

    const me = await agent.get(`${CLIENT_API}/users/me`).expect(200)
    expect(me.body).toMatchObject({ email: credentials.email })
    expect(me.body).not.toHaveProperty('permissions')

    await agent
      .patch(`${CLIENT_API}/users/me`)
      .send({ nickname: 'Renamed' })
      .expect(200)
    expect((await agent.get(`${CLIENT_API}/users/me`)).body.nickname).toBe(
      'Renamed',
    )
  })

  it('logs in with the right password only', async () => {
    const { credentials } = await registerUser(t)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send({ email: uniqueEmail(), password: 'whatever1' })
      .expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send(credentials)
      .expect(200)
  })

  it('rotates refresh tokens and revokes the session when an old token is replayed', async () => {
    const { credentials } = await registerUser(t)
    const login = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send(credentials)
      .expect(200)
    const firstRefresh = cookieValue(
      login.headers['set-cookie'],
      'refresh_token',
    )!

    const refreshed = await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set('Cookie', `refresh_token=${firstRefresh}`)
      .expect(204)
    const secondRefresh = cookieValue(
      refreshed.headers['set-cookie'],
      'refresh_token',
    )!
    const access = cookieValue(refreshed.headers['set-cookie'], 'access_token')!
    expect(secondRefresh).not.toBe(firstRefresh)

    // Concurrent refresh with the just-rotated token: rejected, but the session survives.
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set('Cookie', `refresh_token=${firstRefresh}`)
      .expect(401)
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Cookie', `access_token=${access}`)
      .expect(200)

    // Outside the grace window the replay is treated as theft.
    const sessionId = secondRefresh.split('.')[0]
    await t.pool.query(
      `update auth_sessions set rotated_at = now() - interval '1 hour' where id = $1`,
      [sessionId],
    )
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set('Cookie', `refresh_token=${firstRefresh}`)
      .expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set('Cookie', `refresh_token=${secondRefresh}`)
      .expect(401)
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Cookie', `access_token=${access}`)
      .expect(401)
  })

  it('logout revokes the access token immediately', async () => {
    const { credentials } = await registerUser(t)
    const login = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send(credentials)
      .expect(200)
    const access = cookieValue(login.headers['set-cookie'], 'access_token')!

    const logout = await t
      .http()
      .post(`${CLIENT_API}/auth/logout`)
      .set('Cookie', `access_token=${access}`)
      .expect(204)
    expect(cookieValue(logout.headers['set-cookie'], 'access_token')).toBe('')
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Cookie', `access_token=${access}`)
      .expect(401)
  })

  it('resets a forgotten password with a single-use emailed token', async () => {
    const { agent, credentials } = await registerUser(t)

    const unknown = await t
      .http()
      .post(`${CLIENT_API}/auth/forgot-password`)
      .send({ email: uniqueEmail() })
      .expect(202)
    const known = await t
      .http()
      .post(`${CLIENT_API}/auth/forgot-password`)
      .send({ email: credentials.email })
      .expect(202)
    expect(known.body).toEqual(unknown.body)

    const mail = await waitFor(() =>
      t.mailbox
        .to(credentials.email)
        .find((m) => m.text.includes('reset-password')),
    )
    const token = new URL(
      mail.text.match(/https?:\/\/\S+/)![0],
    ).searchParams.get('token')!

    await t
      .http()
      .post(`${CLIENT_API}/auth/reset-password`)
      .send({ token, password: 'short' })
      .expect(400)
    await t
      .http()
      .post(`${CLIENT_API}/auth/reset-password`)
      .send({ token, password: 'brand-new-pass' })
      .expect(204)
    await t
      .http()
      .post(`${CLIENT_API}/auth/reset-password`)
      .send({ token, password: 'another-pass' })
      .expect(400)

    await agent.get(`${CLIENT_API}/users/me`).expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send(credentials)
      .expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send({ email: credentials.email, password: 'brand-new-pass' })
      .expect(200)
    await waitFor(() =>
      t.mailbox
        .to(credentials.email)
        .find((m) => m.subject.includes('密码已修改')),
    )
  })

  it('sends reset links to the requesting web app only when it is trusted', async () => {
    const { credentials } = await registerUser(t)

    await t
      .http()
      .post(`${CLIENT_API}/auth/forgot-password`)
      .send({
        email: credentials.email,
        resetUrl: 'https://evil.example/reset-password',
      })
      .expect(400)
    await t
      .http()
      .post(`${CLIENT_API}/auth/forgot-password`)
      .send({
        email: credentials.email,
        resetUrl: 'http://localhost:5174/account/reset?from=mail#top',
      })
      .expect(202)

    const mail = await waitFor(() =>
      t.mailbox
        .to(credentials.email)
        .find((m) => m.text.includes('/account/reset')),
    )
    const link = new URL(mail.text.match(/https?:\/\/\S+/)![0])
    expect(link.origin).toBe('http://localhost:5174')
    expect(link.searchParams.get('from')).toBe('mail')
    expect(link.searchParams.get('token')).toMatch(/.{20,}/)
    expect(link.hash).toBe('')
  })

  it('changes the password and keeps only the current session', async () => {
    const { agent, credentials } = await registerUser(t)
    const other = t.agent()
    await other.post(`${CLIENT_API}/auth/login`).send(credentials).expect(200)

    await agent
      .post(`${CLIENT_API}/users/me/password`)
      .send({ currentPassword: 'wrong', newPassword: 'new-password-1' })
      .expect(400)
    await agent
      .post(`${CLIENT_API}/users/me/password`)
      .send({
        currentPassword: credentials.password,
        newPassword: 'new-password-1',
      })
      .expect(204)

    await agent.get(`${CLIENT_API}/users/me`).expect(200)
    await other.get(`${CLIENT_API}/users/me`).expect(401)
    const sessions = await agent
      .get(`${CLIENT_API}/users/me/sessions`)
      .expect(200)
    expect(sessions.body).toHaveLength(1)
    expect(sessions.body[0].current).toBe(true)
  })

  it('stores avatars in object storage and serves them publicly', async () => {
    const { agent } = await registerUser(t)

    const uploaded = await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', PNG, 'me.png')
      .expect(200)
    const avatarUrl = new URL(uploaded.body.avatarUrl as string)
    expect(avatarUrl.pathname).toMatch(
      /^\/api\/avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/,
    )

    const image = await t.http().get(avatarUrl.pathname).expect(200)
    expect(image.headers['content-type']).toBe('image/png')
    expect(image.headers['cache-control']).toContain('immutable')
    expect(Buffer.compare(image.body as Buffer, PNG)).toBe(0)

    await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach('file', Buffer.from('<svg/>'), 'x.svg')
      .expect(415)
    await agent
      .put(`${CLIENT_API}/users/me/avatar`)
      .attach(
        'file',
        Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
        'big.png',
      )
      .expect(413)
    await agent.put(`${CLIENT_API}/users/me/avatar`).send({}).expect(400)

    const removed = await agent
      .delete(`${CLIENT_API}/users/me/avatar`)
      .expect(200)
    expect(removed.body.avatarUrl).toBeNull()
    await t.http().get(avatarUrl.pathname).expect(404)
  })

  it('keeps client users and admin accounts apart, even with the same email', async () => {
    const { agent: user, credentials } = await registerUser(t)
    const superAdmin = await loginAdmin(t, E2E_ADMIN)

    // Client credentials do not work in the admin console and vice versa.
    await t.http().post(`${ADMIN_API}/auth/login`).send(credentials).expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send(ADMIN_LOGIN)
      .expect(401)
    await t
      .http()
      .post(`${ADMIN_API}/auth/register`)
      .send({ ...credentials, nickname: 'Nope' })
      .expect(404)

    // The same email can own an independent admin account with its own password.
    const { agent: admin, admin: adminAccount } = await createAdmin(
      t,
      superAdmin,
      { email: credentials.email },
    )
    const userMe = (await user.get(`${CLIENT_API}/users/me`).expect(200)).body
    const adminMe = (await admin.get(`${ADMIN_API}/me`).expect(200)).body
    expect(adminMe).toMatchObject({
      id: adminAccount.id,
      email: credentials.email,
      roles: [],
      permissions: [],
    })
    expect(adminMe.id).not.toBe(userMe.id)
    await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send(credentials)
      .expect(200)
    await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .send({ email: credentials.email, password: 'admin-password-1' })
      .expect(200)

    // Each session only opens the routes of its own realm.
    await user.get(`${ADMIN_API}/me`).expect(401)
    await admin.get(`${CLIENT_API}/users/me`).expect(401)
    await admin.get(`${CLIENT_API}/rag/knowledge-bases`).expect(401)
  })

  it('uses realm-specific cookies so both sessions live side by side', async () => {
    const { credentials } = await registerUser(t)
    const browser = t.agent()
    await browser.post(`${CLIENT_API}/auth/login`).send(credentials).expect(200)
    const adminLogin = await browser
      .post(`${ADMIN_API}/auth/login`)
      .send(ADMIN_LOGIN)
      .expect(200)
    const cookies = adminLogin.headers['set-cookie'] as unknown as string[]
    expect(cookies.find((c) => c.startsWith('admin_access_token='))).toMatch(
      /Path=\/api\/v1\/admin;.*HttpOnly/,
    )
    expect(cookies.find((c) => c.startsWith('admin_refresh_token='))).toMatch(
      /Path=\/api\/v1\/admin\/auth/,
    )
    expect(adminLogin.body).toMatchObject({
      email: E2E_ADMIN.email,
      roles: ['super_admin'],
      permissions: ['all:manage'],
    })

    await browser.get(`${CLIENT_API}/users/me`).expect(200)
    await browser.get(`${ADMIN_API}/me`).expect(200)
    await browser.post(`${ADMIN_API}/auth/refresh`).expect(204)
    await browser.post(`${ADMIN_API}/auth/logout`).expect(204)
    await browser.get(`${ADMIN_API}/me`).expect(401)
    await browser.get(`${CLIENT_API}/users/me`).expect(200)

    // A token presented under the other realm's cookie name is rejected.
    const userAccess = cookieValue(
      (
        await t
          .http()
          .post(`${CLIENT_API}/auth/login`)
          .send(credentials)
          .expect(200)
      ).headers['set-cookie'],
      'access_token',
    )!
    const adminAccess = cookieValue(
      (await t.http().post(`${ADMIN_API}/auth/login`).send(ADMIN_LOGIN))
        .headers['set-cookie'],
      'admin_access_token',
    )!
    await t
      .http()
      .get(`${ADMIN_API}/me`)
      .set('Cookie', `admin_access_token=${userAccess}`)
      .expect(401)
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Cookie', `access_token=${adminAccess}`)
      .expect(401)
  })

  it('resets admin passwords through the admin auth routes only', async () => {
    const superAdmin = await loginAdmin(t, E2E_ADMIN)
    const { agent, credentials } = await createAdmin(t, superAdmin)

    // The client flow does not know admin emails.
    await t
      .http()
      .post(`${CLIENT_API}/auth/forgot-password`)
      .send({ email: credentials.email })
      .expect(202)
    await t
      .http()
      .post(`${ADMIN_API}/auth/forgot-password`)
      .send({
        email: credentials.email,
        resetUrl: 'http://localhost:5175/auth/reset-password',
      })
      .expect(202)
    const mails = await waitFor(() => {
      const sent = t.mailbox.to(credentials.email)
      return sent.length > 0 ? sent : undefined
    })
    expect(mails).toHaveLength(1)
    const token = new URL(
      mails[0]!.text.match(/https?:\/\/\S+/)![0],
    ).searchParams.get('token')!

    await t
      .http()
      .post(`${CLIENT_API}/auth/reset-password`)
      .send({ token, password: 'brand-new-pass' })
      .expect(400)
    await t
      .http()
      .post(`${ADMIN_API}/auth/reset-password`)
      .send({ token, password: 'brand-new-pass' })
      .expect(204)
    await agent.get(`${ADMIN_API}/me`).expect(401)
    await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .send({ email: credentials.email, password: 'brand-new-pass' })
      .expect(200)
  })

  it('exposes health and OpenAPI docs', async () => {
    const health = await t.http().get(`${API}/health`).expect(200)
    expect(health.body).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    })
    await t.http().get(`${API}/docs-json`).expect(200)
  })

  it('serves realm routes only under their versioned prefix', async () => {
    const { credentials } = await registerUser(t)
    for (const path of [
      '/auth/login',
      '/client/auth/login',
      '/v1/auth/login',
    ]) {
      await t.http().post(`${API}${path}`).send(credentials).expect(404)
    }
    await t.http().post(`${API}/admin/auth/login`).send(ADMIN_LOGIN).expect(404)
    await t.http().get(`${API}/v1/health`).expect(404)
  })

  it('allows credentialed cross-origin calls from the web apps only', async () => {
    for (const method of ['PATCH', 'PUT', 'DELETE']) {
      const preflight = await t
        .http()
        .options(`${CLIENT_API}/users/me`)
        .set('Origin', 'http://localhost:5174')
        .set('Access-Control-Request-Method', method)
        .set('Access-Control-Request-Headers', 'content-type')
        .expect(204)
      expect(preflight.headers['access-control-allow-origin']).toBe(
        'http://localhost:5174',
      )
      expect(preflight.headers['access-control-allow-credentials']).toBe('true')
      expect(preflight.headers['access-control-allow-methods']).toContain(
        method,
      )
    }
    const foreign = await t
      .http()
      .options(`${CLIENT_API}/users/me`)
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'PATCH')
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined()
  })
})
