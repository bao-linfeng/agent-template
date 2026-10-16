import { SecretBox } from '../src/common/crypto/crypto.js'
import { createDatabase } from '../src/database/database.js'
import { reencryptSecrets } from '../src/database/reencrypt-secrets.js'
import { totpCode } from '../src/modules/mfa/totp.js'
import { E2E_PREVIOUS_ENCRYPTION_KEY } from './support/constants.js'
import {
  ADMIN_API,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  type Agent,
  type TestApp,
} from './support/test-app.js'

/** The development default `ENCRYPTION_KEY` the e2e app runs with. */
const CURRENT_KEY = Buffer.alloc(32).toString('base64')

describe('encryption key rotation (e2e)', () => {
  let t: TestApp
  let superAdmin: Agent
  const previous = new SecretBox(E2E_PREVIOUS_ENCRYPTION_KEY)
  const currentOnly = new SecretBox(CURRENT_KEY)

  beforeAll(async () => {
    t = await createTestApp()
    superAdmin = await loginAdmin(t, E2E_ADMIN)
  })

  afterAll(async () => {
    await t.close()
  })

  async function storedValue(
    table: 'ai_embedding_models' | 'admin_totp_credentials',
    column: string,
    idColumn: string,
    id: string,
  ): Promise<string> {
    const { rows } = await t.pool.query<{ value: string }>(
      `select ${column} as value from ${table} where ${idColumn} = $1`,
      [id],
    )
    return rows[0]!.value
  }

  async function createModel(apiKey: string): Promise<string> {
    const created = await superAdmin
      .post(`${ADMIN_API}/ai/embedding-models`)
      .send({
        name: `rotation-${Math.random().toString(36).slice(2, 10)}`,
        baseUrl: process.env.FAKE_EMBEDDINGS_URL,
        model: 'fake-1024',
        dimensions: 1024,
        apiKey,
      })
      .expect(201)
    return created.body.id as string
  }

  async function setApiKeyCiphertext(id: string, value: string) {
    await t.pool.query(
      'update ai_embedding_models set api_key_encrypted = $2 where id = $1',
      [id, value],
    )
  }

  /** Signs in with password + TOTP; every call needs a fresh step, so the last one is forgotten. */
  async function loginWithTotp(
    adminId: string,
    credentials: { email: string; password: string },
    secret: string,
  ) {
    await t.pool.query(
      'update admin_totp_credentials set last_used_step = null where admin_user_id = $1',
      [adminId],
    )
    const challenge = await t
      .http()
      .post(`${ADMIN_API}/auth/login`)
      .send(credentials)
      .expect(200)
    expect(challenge.body.mfaRequired).toBe(true)
    return t
      .http()
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({
        challengeToken: challenge.body.challengeToken,
        code: totpCode(secret),
      })
  }

  it('keeps reading values of a previous key and moves them to the current key', async () => {
    // An admin with TOTP whose secret was stored before the rotation.
    const { agent, admin, credentials } = await createAdmin(t, superAdmin)
    const setup = await agent
      .post(`${ADMIN_API}/me/mfa/totp/setup`)
      .send({ password: credentials.password })
      .expect(200)
    const secret = setup.body.secret as string
    await agent
      .post(`${ADMIN_API}/me/mfa/totp/enable`)
      .send({ code: totpCode(secret) })
      .expect(200)
    await t.pool.query(
      'update admin_totp_credentials set secret_encrypted = $2 where admin_user_id = $1',
      [admin.id, previous.encrypt(secret)],
    )

    // An embedding model whose API key was stored before the rotation, and one no key can read.
    const modelId = await createModel('sk-rotate')
    const oldCiphertext = previous.encrypt('sk-rotate')
    await setApiKeyCiphertext(modelId, oldCiphertext)
    const lostId = await createModel('sk-lost')
    const lostCiphertext = new SecretBox(
      Buffer.alloc(32, 5).toString('base64'),
    ).encrypt('sk-lost')
    await setApiKeyCiphertext(lostId, lostCiphertext)

    // The API decrypts with the previous key.
    await loginWithTotp(admin.id, credentials, secret).then((response) =>
      expect(response.status).toBe(200),
    )
    expect(
      (
        await superAdmin
          .post(`${ADMIN_API}/ai/embedding-models/${modelId}/test`)
          .expect(200)
      ).body,
    ).toMatchObject({ ok: true })
    const lost = await superAdmin
      .post(`${ADMIN_API}/ai/embedding-models/${lostId}/test`)
      .expect(500)
    expect(lost.body.code).toBe('INTERNAL_ERROR')

    const db = createDatabase(t.pool)
    const box = t.app.get(SecretBox)

    // Dry run: reports, changes nothing.
    const dryRun = await reencryptSecrets(db, box, { dryRun: true })
    expect(dryRun).toEqual([
      expect.objectContaining({
        column: 'ai_embedding_models.api_key_encrypted',
        previous: 1,
        reencrypted: 0,
        unreadable: [lostId],
      }),
      expect.objectContaining({
        column: 'admin_totp_credentials.secret_encrypted',
        previous: 1,
        reencrypted: 0,
        unreadable: [],
      }),
    ])
    expect(
      await storedValue(
        'ai_embedding_models',
        'api_key_encrypted',
        'id',
        modelId,
      ),
    ).toBe(oldCiphertext)

    const run = await reencryptSecrets(db, box)
    expect(
      run.map(({ previous, reencrypted }) => [previous, reencrypted]),
    ).toEqual([
      [1, 1],
      [1, 1],
    ])
    expect(run[0]!.unreadable).toEqual([lostId])

    // Re-encrypted values need only the current key; unreadable ones are left alone.
    const apiKey = await storedValue(
      'ai_embedding_models',
      'api_key_encrypted',
      'id',
      modelId,
    )
    expect(apiKey).toMatch(/^v1\./)
    expect(currentOnly.decrypt(apiKey)).toBe('sk-rotate')
    expect(
      currentOnly.decrypt(
        await storedValue(
          'admin_totp_credentials',
          'secret_encrypted',
          'admin_user_id',
          admin.id,
        ),
      ),
    ).toBe(secret)
    expect(
      await storedValue(
        'ai_embedding_models',
        'api_key_encrypted',
        'id',
        lostId,
      ),
    ).toBe(lostCiphertext)

    // Idempotent: nothing left on the previous key.
    const again = await reencryptSecrets(db, box, { dryRun: true })
    expect(again.map((result) => result.previous)).toEqual([0, 0])

    await loginWithTotp(admin.id, credentials, secret).then((response) =>
      expect(response.status).toBe(200),
    )

    await superAdmin
      .delete(`${ADMIN_API}/ai/embedding-models/${modelId}`)
      .expect(204)
    await superAdmin
      .delete(`${ADMIN_API}/ai/embedding-models/${lostId}`)
      .expect(204)
  })
})
