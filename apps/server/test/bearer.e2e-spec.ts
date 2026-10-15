import {
  ADMIN_API,
  CLIENT_API,
  cookieValue,
  createTestApp,
  E2E_ADMIN,
  requestRegisterCode,
  uniqueEmail,
  type TestApp,
} from './support/test-app.js'

const BEARER = { 'X-Auth-Transport': 'bearer' }

interface BearerTokens {
  tokenType: string
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
}

describe('bearer transport for non-browser clients (e2e)', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(async () => {
    await t.close()
  })

  async function signUp() {
    const credentials = { email: uniqueEmail('app'), password: 'password123' }
    const code = await requestRegisterCode(t, credentials.email)
    const response = await t
      .http()
      .post(`${CLIENT_API}/auth/register`)
      .set(BEARER)
      .send({ ...credentials, nickname: 'App', code })
      .expect(201)
    return {
      credentials,
      body: response.body as {
        account: { email: string }
        tokens: BearerTokens
      },
      setCookie: response.headers['set-cookie'],
    }
  }

  it('returns tokens in the body instead of cookies and accepts Authorization: Bearer', async () => {
    const { credentials, body, setCookie } = await signUp()
    expect(setCookie).toBeUndefined()
    expect(body.account).toMatchObject({ email: credentials.email })
    expect(body.tokens).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: expect.any(Number),
      refreshExpiresIn: expect.any(Number),
    })

    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .expect(200)
    await t.http().get(`${CLIENT_API}/users/me`).expect(401)
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401)

    const login = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .set(BEARER)
      .send(credentials)
      .expect(200)
    expect(login.headers['set-cookie']).toBeUndefined()
    expect(login.body).toMatchObject({
      account: { email: credentials.email },
      tokens: { tokenType: 'Bearer' },
    })
  })

  it('rotates the refresh token from the body and revokes the session on logout', async () => {
    const { tokens } = (await signUp()).body

    const refreshed = await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set(BEARER)
      .send({ refreshToken: tokens.refreshToken })
      .expect(200)
    const next = refreshed.body as BearerTokens
    expect(refreshed.headers['set-cookie']).toBeUndefined()
    expect(next.tokenType).toBe('Bearer')
    expect(next.refreshToken).not.toBe(tokens.refreshToken)

    // The rotated-out token no longer works; a missing one is a 401 the app can react to.
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set(BEARER)
      .send({ refreshToken: tokens.refreshToken })
      .expect(401)
    await t.http().post(`${CLIENT_API}/auth/refresh`).set(BEARER).expect(401)

    await t
      .http()
      .post(`${CLIENT_API}/auth/logout`)
      .set(BEARER)
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(204)
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(401)
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set(BEARER)
      .send({ refreshToken: next.refreshToken })
      .expect(401)
  })

  it('logs out with only the refresh token', async () => {
    const { tokens } = (await signUp()).body
    await t
      .http()
      .post(`${CLIENT_API}/auth/logout`)
      .set(BEARER)
      .send({ refreshToken: tokens.refreshToken })
      .expect(204)
    await t
      .http()
      .get(`${CLIENT_API}/users/me`)
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(401)
  })

  it('rejects mixed or unknown transports', async () => {
    const { tokens } = (await signUp()).body
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .send({ refreshToken: tokens.refreshToken })
      .expect(400)
    await t
      .http()
      .post(`${CLIENT_API}/auth/refresh`)
      .set('X-Auth-Transport', 'token')
      .send({ refreshToken: tokens.refreshToken })
      .expect(400)
  })

  it('keeps the admin console cookie-only', async () => {
    const adminLogin = { email: E2E_ADMIN.email, password: E2E_ADMIN.password }
    await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .set(BEARER)
      .send(adminLogin)
      .expect(400)

    const login = await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .send(adminLogin)
      .expect(200)
    const adminAccess = cookieValue(
      login.headers['set-cookie'],
      'admin_access_token',
    )!
    await t
      .http()
      .get(`${ADMIN_API}/me`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(401)

    // A client bearer token does not open admin routes either.
    const { tokens } = (await signUp()).body
    await t
      .http()
      .get(`${ADMIN_API}/me`)
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(401)
  })
})
