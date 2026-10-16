import {
  API,
  CLIENT_API,
  createTestApp,
  registerUser,
  type TestApp,
} from './support/test-app.js'

describe('error responses (e2e)', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(async () => {
    await t.close()
  })

  it('answers unknown routes with NOT_FOUND', async () => {
    const response = await t.http().get(`${API}/nope`).expect(404)
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.stringContaining('/api/nope'),
    })
  })

  it('maps Fastify body errors to their status', async () => {
    const response = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400)
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    })
  })

  it('reports validation errors per field', async () => {
    const response = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send({ email: 'not-an-email', password: 'password123', extra: 1 })
      .expect(400)
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: expect.any(String),
    })
    const fields = (response.body.details as { field: string }[]).map(
      (detail) => detail.field,
    )
    expect(fields).toEqual(expect.arrayContaining(['email', 'extra']))
  })

  it('returns business codes from AppException', async () => {
    await t.http().get(`${CLIENT_API}/users/me`).expect(401, {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    })

    const { credentials } = await registerUser(t)
    const login = await t
      .http()
      .post(`${CLIENT_API}/auth/login`)
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401)
    expect(login.body).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' })
  })

  it('documents the error body in OpenAPI', async () => {
    const { body } = await t.http().get(`${API}/docs-json`).expect(200)
    // Its properties come from the Swagger CLI plugin, which only runs in `nest build`.
    expect(body.components.schemas).toHaveProperty('ErrorResponseDto')
    expect(
      body.paths['/api/v1/client/auth/login'].post.responses,
    ).toHaveProperty('default')
  })

  it('keeps the readiness body on the health route', async () => {
    const response = await t.http().get(`${API}/health`).expect(200)
    expect(response.body).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    })
  })
})
