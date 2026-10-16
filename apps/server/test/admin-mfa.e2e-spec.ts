import { AuditService } from '../src/modules/audit/audit.service.js'
import { MFA_CHALLENGE_MAX_ATTEMPTS } from '../src/modules/mfa/mfa.service.js'
import { totpCode } from '../src/modules/mfa/totp.js'
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

const PERIOD_MS = 30_000

/** A well-formed code that no step in the accepted window produces. */
function wrongCode(secret: string): string {
  const valid = new Set(
    [-PERIOD_MS, 0, PERIOD_MS].map((offset) =>
      totpCode(secret, Date.now() + offset),
    ),
  )
  let candidate = 0
  while (valid.has(String(candidate).padStart(6, '0'))) {
    candidate++
  }
  return String(candidate).padStart(6, '0')
}

describe('admin two-factor authentication (e2e)', () => {
  let t: TestApp
  let superAdmin: Agent

  beforeAll(async () => {
    t = await createTestApp()
    superAdmin = await loginAdmin(t, E2E_ADMIN)
  })

  afterAll(async () => {
    await t.close()
  })

  /** Lets the current TOTP code be used again (each step is accepted only once per admin). */
  async function forgetUsedStep(adminId: string): Promise<void> {
    await t.pool.query(
      'update admin_totp_credentials set last_used_step = null where admin_user_id = $1',
      [adminId],
    )
  }

  /** Creates an admin and enables TOTP for it; returns the secret and recovery codes. */
  async function adminWithTotp() {
    const created = await createAdmin(t, superAdmin)
    const setup = await created.agent
      .post(`${ADMIN_API}/me/mfa/totp/setup`)
      .send({ password: created.credentials.password })
      .expect(200)
    const secret = setup.body.secret as string
    const enabled = await created.agent
      .post(`${ADMIN_API}/me/mfa/totp/enable`)
      .send({ code: totpCode(secret) })
      .expect(200)
    await forgetUsedStep(created.admin.id)
    return {
      ...created,
      secret,
      recoveryCodes: enabled.body.recoveryCodes as string[],
    }
  }

  async function startLogin(credentials: { email: string; password: string }) {
    const agent = t.agent()
    const response = await agent
      .post(`${ADMIN_API}/auth/login`)
      .send(credentials)
      .expect(200)
    return { agent, response }
  }

  it('enables TOTP after confirming the password and the first code', async () => {
    const { agent, admin, credentials } = await createAdmin(t, superAdmin)
    const other = await loginAdmin(t, credentials)

    expect((await agent.get(`${ADMIN_API}/me/mfa`).expect(200)).body).toEqual({
      totpEnabled: false,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    })
    expect((await agent.get(`${ADMIN_API}/me`).expect(200)).body).toMatchObject(
      { mfaEnabled: false },
    )

    const wrongPassword = await agent
      .post(`${ADMIN_API}/me/mfa/totp/setup`)
      .send({ password: 'not-the-password' })
      .expect(400)
    expect(wrongPassword.body.code).toBe('ACCOUNT_PASSWORD_INCORRECT')
    const noSetup = await agent
      .post(`${ADMIN_API}/me/mfa/totp/enable`)
      .send({ code: '123456' })
      .expect(400)
    expect(noSetup.body.code).toBe('MFA_SETUP_EXPIRED')

    const setup = await agent
      .post(`${ADMIN_API}/me/mfa/totp/setup`)
      .send({ password: credentials.password })
      .expect(200)
    const secret = setup.body.secret as string
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(setup.body.expiresIn).toBe(600)
    expect(setup.body.otpauthUri).toBe(
      `otpauth://totp/Agent%20Admin:${encodeURIComponent(admin.email)}?secret=${secret}&issuer=Agent+Admin&algorithm=SHA1&digits=6&period=30`,
    )

    const wrong = await agent
      .post(`${ADMIN_API}/me/mfa/totp/enable`)
      .send({ code: wrongCode(secret) })
      .expect(400)
    expect(wrong.body.code).toBe('AUTH_MFA_CODE_INVALID')

    const enabled = await agent
      .post(`${ADMIN_API}/me/mfa/totp/enable`)
      .send({ code: totpCode(secret) })
      .expect(200)
    const recoveryCodes = enabled.body.recoveryCodes as string[]
    expect(recoveryCodes).toHaveLength(10)
    expect(new Set(recoveryCodes).size).toBe(10)
    for (const code of recoveryCodes) {
      expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/)
    }

    // Other sessions are signed out, the current one stays.
    await other.get(`${ADMIN_API}/me`).expect(401)
    expect((await agent.get(`${ADMIN_API}/me`).expect(200)).body).toMatchObject(
      { mfaEnabled: true },
    )
    const status = await agent.get(`${ADMIN_API}/me/mfa`).expect(200)
    expect(status.body).toMatchObject({
      totpEnabled: true,
      recoveryCodesRemaining: 10,
    })
    expect(status.body.enabledAt).toEqual(expect.any(String))

    const again = await agent
      .post(`${ADMIN_API}/me/mfa/totp/setup`)
      .send({ password: credentials.password })
      .expect(409)
    expect(again.body.code).toBe('MFA_ALREADY_ENABLED')

    const mail = await waitFor(() =>
      t.mailbox
        .to(admin.email)
        .find((message) => message.subject.includes('两步验证已开启')),
    )
    expect(mail.text).not.toContain(secret)

    // Neither the code nor the secret reaches the audit trail.
    const entry = await waitFor(async () => {
      await t.app.get(AuditService).flush()
      const response = await superAdmin
        .get(`${ADMIN_API}/audit-logs`)
        .query({ actorId: admin.id, action: 'AdminMfaController.enable' })
        .expect(200)
      return (
        response.body.items as { statusCode: number; body: unknown }[]
      ).find((item) => item.statusCode === 200)
    })
    expect(entry.body).toEqual({ code: '[redacted]' })
  })

  it('signs in with a second step that accepts TOTP and recovery codes once', async () => {
    const { admin, credentials, secret, recoveryCodes } = await adminWithTotp()

    const { agent, response } = await startLogin(credentials)
    expect(response.body).toEqual({
      mfaRequired: true,
      challengeToken: expect.any(String),
      expiresIn: 300,
    })
    expect(
      cookieValue(response.headers['set-cookie'], 'admin_access_token'),
    ).toBeUndefined()
    await agent.get(`${ADMIN_API}/me`).expect(401)

    const challengeToken = response.body.challengeToken as string
    const wrong = await agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({ challengeToken, code: wrongCode(secret) })
      .expect(400)
    expect(wrong.body.code).toBe('AUTH_MFA_CODE_INVALID')

    const code = totpCode(secret)
    const signedIn = await agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({ challengeToken, code })
      .expect(200)
    expect(signedIn.body).toMatchObject({ id: admin.id, mfaEnabled: true })
    await agent.get(`${ADMIN_API}/me`).expect(200)

    // A challenge works once.
    const reused = await t
      .http()
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({ challengeToken, code })
      .expect(400)
    expect(reused.body.code).toBe('AUTH_MFA_CHALLENGE_INVALID')

    // So does a TOTP code, even with a fresh challenge.
    const second = await startLogin(credentials)
    const replay = await second.agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({ challengeToken: second.response.body.challengeToken, code })
      .expect(400)
    expect(replay.body.code).toBe('AUTH_MFA_CODE_INVALID')

    // Recovery codes ignore case, spaces and dashes, and are single use.
    const recovery = recoveryCodes[0]!
    const typed = ` ${recovery.toUpperCase().replace('-', ' ')} `
    await second.agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({
        challengeToken: second.response.body.challengeToken,
        code: typed,
      })
      .expect(200)
    const third = await startLogin(credentials)
    const usedRecovery = await third.agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({
        challengeToken: third.response.body.challengeToken,
        code: recovery,
      })
      .expect(400)
    expect(usedRecovery.body.code).toBe('AUTH_MFA_CODE_INVALID')
    const status = await third.agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({
        challengeToken: third.response.body.challengeToken,
        code: recoveryCodes[1],
      })
      .expect(200)
    expect(status.body.mfaEnabled).toBe(true)
    expect(
      (await third.agent.get(`${ADMIN_API}/me/mfa`).expect(200)).body
        .recoveryCodesRemaining,
    ).toBe(8)
  })

  it('discards a challenge after too many wrong codes', async () => {
    const { credentials, secret } = await adminWithTotp()
    const { agent, response } = await startLogin(credentials)
    const challengeToken = response.body.challengeToken as string
    for (let i = 0; i < MFA_CHALLENGE_MAX_ATTEMPTS; i++) {
      const wrong = await agent
        .post(`${ADMIN_API}/auth/login/mfa`)
        .send({ challengeToken, code: wrongCode(secret) })
        .expect(400)
      expect(wrong.body.code).toBe('AUTH_MFA_CODE_INVALID')
    }
    const exhausted = await agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({ challengeToken, code: totpCode(secret) })
      .expect(400)
    expect(exhausted.body.code).toBe('AUTH_MFA_CHALLENGE_INVALID')

    const unknown = await agent
      .post(`${ADMIN_API}/auth/login/mfa`)
      .send({ challengeToken: 'x'.repeat(43), code: totpCode(secret) })
      .expect(400)
    expect(unknown.body.code).toBe('AUTH_MFA_CHALLENGE_INVALID')
  })

  it('regenerates recovery codes and disables TOTP with password and code', async () => {
    const { agent, admin, credentials, secret, recoveryCodes } =
      await adminWithTotp()

    const wrongPassword = await agent
      .post(`${ADMIN_API}/me/mfa/recovery-codes`)
      .send({ password: 'not-the-password', code: totpCode(secret) })
      .expect(400)
    expect(wrongPassword.body.code).toBe('ACCOUNT_PASSWORD_INCORRECT')
    const wrongCodeResponse = await agent
      .post(`${ADMIN_API}/me/mfa/recovery-codes`)
      .send({ password: credentials.password, code: wrongCode(secret) })
      .expect(400)
    expect(wrongCodeResponse.body.code).toBe('AUTH_MFA_CODE_INVALID')

    const regenerated = await agent
      .post(`${ADMIN_API}/me/mfa/recovery-codes`)
      .send({ password: credentials.password, code: totpCode(secret) })
      .expect(200)
    const fresh = regenerated.body.recoveryCodes as string[]
    expect(fresh).toHaveLength(10)
    expect(fresh).not.toContain(recoveryCodes[0])

    // Old recovery codes stopped working; a new one turns TOTP off.
    const stale = await agent
      .post(`${ADMIN_API}/me/mfa/totp/disable`)
      .send({ password: credentials.password, code: recoveryCodes[0] })
      .expect(400)
    expect(stale.body.code).toBe('AUTH_MFA_CODE_INVALID')
    await agent
      .post(`${ADMIN_API}/me/mfa/totp/disable`)
      .send({ password: credentials.password, code: fresh[0] })
      .expect(204)

    expect((await agent.get(`${ADMIN_API}/me/mfa`).expect(200)).body).toEqual({
      totpEnabled: false,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    })
    const notEnabled = await agent
      .post(`${ADMIN_API}/me/mfa/totp/disable`)
      .send({ password: credentials.password, code: fresh[1] })
      .expect(409)
    expect(notEnabled.body.code).toBe('MFA_NOT_ENABLED')
    await waitFor(() =>
      t.mailbox
        .to(admin.email)
        .find((message) => message.subject.includes('两步验证已关闭')),
    )

    // Back to password-only sign-in.
    await loginAdmin(t, credentials)
  })

  it('lets administrators reset the second factor of others only', async () => {
    const target = await adminWithTotp()
    const superAdminId = (await superAdmin.get(`${ADMIN_API}/me`).expect(200))
      .body.id as string

    const listed = await superAdmin
      .get(`${ADMIN_API}/admins`)
      .query({ keyword: target.admin.email })
      .expect(200)
    expect(listed.body.items[0]).toMatchObject({
      id: target.admin.id,
      mfaEnabled: true,
    })
    expect(
      (
        await superAdmin
          .get(`${ADMIN_API}/admins/${target.admin.id}`)
          .expect(200)
      ).body.mfaEnabled,
    ).toBe(true)

    // Without `admin:update`.
    const plain = await createAdmin(t, superAdmin)
    await plain.agent
      .delete(`${ADMIN_API}/admins/${target.admin.id}/mfa`)
      .expect(403)

    const self = await superAdmin
      .delete(`${ADMIN_API}/admins/${superAdminId}/mfa`)
      .expect(400)
    expect(self.body.code).toBe('ADMIN_CANNOT_RESET_OWN_MFA')

    await superAdmin
      .delete(`${ADMIN_API}/admins/${target.admin.id}/mfa`)
      .expect(204)
    // Signed out everywhere, password-only sign-in again, recovery codes gone.
    await target.agent.get(`${ADMIN_API}/me`).expect(401)
    const relogin = await loginAdmin(t, target.credentials)
    expect((await relogin.get(`${ADMIN_API}/me/mfa`).expect(200)).body).toEqual(
      {
        totpEnabled: false,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      },
    )
    await waitFor(() =>
      t.mailbox
        .to(target.admin.email)
        .find((message) => message.subject.includes('两步验证已被重置')),
    )

    const again = await superAdmin
      .delete(`${ADMIN_API}/admins/${target.admin.id}/mfa`)
      .expect(409)
    expect(again.body.code).toBe('MFA_NOT_ENABLED')
    await superAdmin
      .delete(`${ADMIN_API}/admins/00000000-0000-4000-8000-000000000000/mfa`)
      .expect(404)
  })

  it('keeps client sign-in unaffected', async () => {
    // Client login still answers the profile directly (no second factor in that realm).
    const { agent, credentials } = await registerUser(t)
    const login = await agent
      .post(`${CLIENT_API}/auth/login`)
      .send(credentials)
      .expect(200)
    expect(login.body).not.toHaveProperty('mfaRequired')
    await agent.get(`${CLIENT_API}/users/me`).expect(200)
  })
})
