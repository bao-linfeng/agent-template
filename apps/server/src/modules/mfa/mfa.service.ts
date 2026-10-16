import { randomInt } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, count, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { randomToken, SecretBox, sha256 } from '../../common/crypto/crypto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'
import type { Database, DbExecutor } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import {
  adminRecoveryCodes,
  adminTotpCredentials,
} from '../../database/schema/index.js'
import { mailTemplates } from '../../infra/mail/mail.templates.js'
import { MailService } from '../../infra/mail/mail.service.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import {
  AccountsService,
  type AccountRow,
} from '../accounts/accounts.service.js'
import { SessionsService } from '../auth/sessions.service.js'
import { generateTotpSecret, TOTP_DIGITS, totpUri, verifyTotp } from './totp.js'

/** `GET /v1/admin/me/mfa`. */
export interface MfaStatus {
  totpEnabled: boolean
  enabledAt: Date | null
  /** Unused recovery codes left; regenerate them before they run out. */
  recoveryCodesRemaining: number
}

/** Pending authenticator setup; confirm it with a code within `expiresIn` seconds. */
export interface TotpSetup {
  /** Base32 secret for manual entry. */
  secret: string
  /** `otpauth://totp/...` URI to render as a QR code. */
  otpauthUri: string
  expiresIn: number
}

/** Shown once; only hashes are stored. */
export interface RecoveryCodes {
  recoveryCodes: string[]
}

/**
 * Answer of `POST /v1/admin/auth/login` for admins with two-factor authentication: no cookies yet,
 * complete the sign-in with `POST /v1/admin/auth/login/mfa`.
 */
export interface MfaChallenge {
  mfaRequired: true
  challengeToken: string
  /** Seconds until the challenge expires and the password has to be entered again. */
  expiresIn: number
}

export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60
/** Wrong codes allowed per sign-in challenge before the password has to be entered again. */
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5
const SETUP_TTL_SECONDS = 10 * 60
export const RECOVERY_CODE_COUNT = 10
// No 0/o, 1/l/i: recovery codes are read from paper.
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const RECOVERY_CODE_LENGTH = 10

// KEYS[1] = challenge; ARGV[1] = max attempts. Counts the attempt before the code is checked, so
// parallel guesses cannot exceed the limit. Returns { adminUserId, attempts } or nil.
const CHALLENGE_ATTEMPT_SCRIPT = `
local id = redis.call('HGET', KEYS[1], 'adminUserId')
if not id then
  return false
end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if attempts > tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return false
end
return { id, attempts }
`

/** `xxxxx-xxxxx` from the reduced alphabet (~50 bits). */
function generateRecoveryCode(): string {
  const chars = Array.from(
    { length: RECOVERY_CODE_LENGTH },
    () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
  ).join('')
  return `${chars.slice(0, 5)}-${chars.slice(5)}`
}

/** Case, spaces and dashes do not matter when a recovery code is typed. */
function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, '')
}

/**
 * Authenticator-app (TOTP, RFC 6238) second factor of admin console accounts, with one-time recovery
 * codes. Admins enable it themselves (`/v1/admin/me/mfa`); administrators with `admin:update` can
 * reset it for others who lost their device. Sign-in then takes two steps: the password yields a
 * short-lived challenge (Redis, hashed, `MFA_CHALLENGE_MAX_ATTEMPTS`), which a code turns into a
 * session. Every accepted TOTP step is stored, so a code cannot be replayed.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name)
  private readonly issuer: string

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly box: SecretBox,
    private readonly accounts: AccountsService,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.issuer = config.get('MFA_TOTP_ISSUER', { infer: true })
  }

  // ---- Status ------------------------------------------------------------------------------

  async status(adminUserId: string): Promise<MfaStatus> {
    const [credential] = await this.db
      .select({ createdAt: adminTotpCredentials.createdAt })
      .from(adminTotpCredentials)
      .where(eq(adminTotpCredentials.adminUserId, adminUserId))
      .limit(1)
    if (!credential) {
      return { totpEnabled: false, enabledAt: null, recoveryCodesRemaining: 0 }
    }
    const [remaining] = await this.db
      .select({ value: count() })
      .from(adminRecoveryCodes)
      .where(
        and(
          eq(adminRecoveryCodes.adminUserId, adminUserId),
          isNull(adminRecoveryCodes.usedAt),
        ),
      )
    return {
      totpEnabled: true,
      enabledAt: credential.createdAt,
      recoveryCodesRemaining: remaining?.value ?? 0,
    }
  }

  /** Ids (of `adminUserIds`) with two-factor authentication enabled. */
  async enabledAmong(adminUserIds: string[]): Promise<Set<string>> {
    if (adminUserIds.length === 0) {
      return new Set()
    }
    const rows = await this.db
      .select({ id: adminTotpCredentials.adminUserId })
      .from(adminTotpCredentials)
      .where(inArray(adminTotpCredentials.adminUserId, adminUserIds))
    return new Set(rows.map((row) => row.id))
  }

  async isEnabled(adminUserId: string): Promise<boolean> {
    return (await this.enabledAmong([adminUserId])).has(adminUserId)
  }

  // ---- Self-service ------------------------------------------------------------------------

  /** Starts (or restarts) enrollment; nothing changes until `enableTotp` confirms a code. */
  async startTotpSetup(
    adminUserId: string,
    password: string,
  ): Promise<TotpSetup> {
    const account = await this.accounts.verifyPassword(
      'admin',
      adminUserId,
      password,
    )
    if (await this.isEnabled(adminUserId)) {
      throw new AppException('MFA_ALREADY_ENABLED')
    }
    const secret = generateTotpSecret()
    await this.redis.set(
      this.setupKey(adminUserId),
      this.box.encrypt(secret),
      'EX',
      SETUP_TTL_SECONDS,
    )
    return {
      secret,
      otpauthUri: totpUri({
        issuer: this.issuer,
        account: account.email,
        secret,
      }),
      expiresIn: SETUP_TTL_SECONDS,
    }
  }

  /**
   * Confirms the pending setup with a code from the app, enables TOTP, returns fresh recovery codes
   * and signs out every other session.
   */
  async enableTotp(
    adminUserId: string,
    sessionId: string,
    code: string,
  ): Promise<RecoveryCodes> {
    const setupKey = this.setupKey(adminUserId)
    const secretEncrypted = await this.redis.get(setupKey)
    if (!secretEncrypted) {
      throw new AppException('MFA_SETUP_EXPIRED')
    }
    const step = verifyTotp(this.box.decrypt(secretEncrypted), code)
    if (step === null) {
      throw new AppException('AUTH_MFA_CODE_INVALID')
    }
    const recoveryCodes = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(adminTotpCredentials)
        .values({ adminUserId, secretEncrypted, lastUsedStep: step })
        .onConflictDoNothing()
        .returning({ id: adminTotpCredentials.adminUserId })
      if (inserted.length === 0) {
        throw new AppException('MFA_ALREADY_ENABLED')
      }
      return this.replaceRecoveryCodes(adminUserId, tx)
    })
    await this.redis.del(setupKey)
    await this.sessions.revokeAllForUser('admin', adminUserId, {
      exceptSessionId: sessionId,
    })
    await this.notify(adminUserId, 'enabled')
    return { recoveryCodes }
  }

  /** Turns TOTP off; needs the password and a current code (or a recovery code). */
  async disableTotp(
    adminUserId: string,
    password: string,
    code: string,
  ): Promise<void> {
    await this.accounts.verifyPassword('admin', adminUserId, password)
    await this.assertSecondFactor(adminUserId, code)
    await this.remove(adminUserId)
    await this.notify(adminUserId, 'disabled')
  }

  /** Replaces every recovery code; the old ones stop working. */
  async regenerateRecoveryCodes(
    adminUserId: string,
    password: string,
    code: string,
  ): Promise<RecoveryCodes> {
    await this.accounts.verifyPassword('admin', adminUserId, password)
    await this.assertSecondFactor(adminUserId, code)
    const recoveryCodes = await this.db.transaction((tx) =>
      this.replaceRecoveryCodes(adminUserId, tx),
    )
    return { recoveryCodes }
  }

  // ---- Administration ----------------------------------------------------------------------

  /**
   * Removes another admin's second factor (lost device) and signs them out everywhere; they sign in
   * with the password alone and may enable it again. Not for yourself: a hijacked session must not
   * be able to drop the second factor of its own account.
   */
  async resetForAdmin(actorId: string, adminUserId: string): Promise<void> {
    if (actorId === adminUserId) {
      throw new AppException('ADMIN_CANNOT_RESET_OWN_MFA')
    }
    await this.accounts.getOrThrow('admin', adminUserId)
    if (!(await this.remove(adminUserId))) {
      throw new AppException('MFA_NOT_ENABLED')
    }
    await this.sessions.revokeAllForUser('admin', adminUserId)
    await this.notify(adminUserId, 'reset')
    this.logger.log(
      `Two-factor authentication of admin ${adminUserId} reset by ${actorId}`,
    )
  }

  // ---- Sign-in -----------------------------------------------------------------------------

  /** Challenge for an admin whose password matched, or null when no second factor is enabled. */
  async createChallenge(account: AccountRow): Promise<MfaChallenge | null> {
    if (!(await this.isEnabled(account.id))) {
      return null
    }
    const challengeToken = randomToken()
    const key = this.challengeKey(challengeToken)
    await this.redis
      .multi()
      .hset(key, { adminUserId: account.id, attempts: 0 })
      .expire(key, MFA_CHALLENGE_TTL_SECONDS)
      .exec()
    return {
      mfaRequired: true,
      challengeToken,
      expiresIn: MFA_CHALLENGE_TTL_SECONDS,
    }
  }

  /**
   * Consumes a challenge with a TOTP or recovery code and returns the account to start a session for.
   * Wrong codes count against the challenge; an expired or exhausted one needs the password again.
   */
  async completeChallenge(
    challengeToken: string,
    code: string,
  ): Promise<AccountRow> {
    const key = this.challengeKey(challengeToken)
    const attempt = (await this.redis.eval(
      CHALLENGE_ATTEMPT_SCRIPT,
      1,
      key,
      MFA_CHALLENGE_MAX_ATTEMPTS,
    )) as [string, number] | null
    if (!attempt) {
      throw new AppException('AUTH_MFA_CHALLENGE_INVALID')
    }
    const [adminUserId, attempts] = attempt
    if (!(await this.verifySecondFactor(adminUserId, code))) {
      if (attempts >= MFA_CHALLENGE_MAX_ATTEMPTS) {
        await this.redis.del(key)
      }
      throw new AppException('AUTH_MFA_CODE_INVALID')
    }
    // Single use: a parallel request that also passed loses here.
    if ((await this.redis.del(key)) === 0) {
      throw new AppException('AUTH_MFA_CHALLENGE_INVALID')
    }
    const account = await this.accounts.findById('admin', adminUserId)
    if (!account) {
      throw new AppException('AUTH_MFA_CHALLENGE_INVALID')
    }
    if (account.status !== 'active') {
      throw new AppException('AUTH_ACCOUNT_DISABLED')
    }
    return account
  }

  // ---- Internals ---------------------------------------------------------------------------

  private async assertSecondFactor(
    adminUserId: string,
    code: string,
  ): Promise<void> {
    if (!(await this.isEnabled(adminUserId))) {
      throw new AppException('MFA_NOT_ENABLED')
    }
    if (!(await this.verifySecondFactor(adminUserId, code))) {
      throw new AppException('AUTH_MFA_CODE_INVALID')
    }
  }

  /** A `TOTP_DIGITS`-digit code is checked as TOTP, anything else as a recovery code; both are single use. */
  private async verifySecondFactor(
    adminUserId: string,
    code: string,
  ): Promise<boolean> {
    const trimmed = code.trim()
    if (new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(trimmed)) {
      return this.consumeTotp(adminUserId, trimmed)
    }
    const normalized = normalizeRecoveryCode(trimmed)
    if (normalized.length !== RECOVERY_CODE_LENGTH) {
      return false
    }
    const used = await this.db
      .update(adminRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(adminRecoveryCodes.adminUserId, adminUserId),
          eq(adminRecoveryCodes.codeHash, sha256(normalized)),
          isNull(adminRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: adminRecoveryCodes.id })
    return used.length > 0
  }

  private async consumeTotp(
    adminUserId: string,
    code: string,
  ): Promise<boolean> {
    const [credential] = await this.db
      .select()
      .from(adminTotpCredentials)
      .where(eq(adminTotpCredentials.adminUserId, adminUserId))
      .limit(1)
    if (!credential) {
      return false
    }
    const step = verifyTotp(this.box.decrypt(credential.secretEncrypted), code)
    if (step === null) {
      return false
    }
    // Atomic: of two requests with the same code only one moves the step forward.
    const accepted = await this.db
      .update(adminTotpCredentials)
      .set({ lastUsedStep: step })
      .where(
        and(
          eq(adminTotpCredentials.adminUserId, adminUserId),
          or(
            isNull(adminTotpCredentials.lastUsedStep),
            lt(adminTotpCredentials.lastUsedStep, step),
          ),
        ),
      )
      .returning({ id: adminTotpCredentials.adminUserId })
    return accepted.length > 0
  }

  private async replaceRecoveryCodes(
    adminUserId: string,
    executor: DbExecutor,
  ): Promise<string[]> {
    const codes = Array.from(
      { length: RECOVERY_CODE_COUNT },
      generateRecoveryCode,
    )
    await executor
      .delete(adminRecoveryCodes)
      .where(eq(adminRecoveryCodes.adminUserId, adminUserId))
    await executor.insert(adminRecoveryCodes).values(
      codes.map((code) => ({
        adminUserId,
        codeHash: sha256(normalizeRecoveryCode(code)),
      })),
    )
    return codes
  }

  /** Deletes the TOTP secret and recovery codes; false when TOTP was not enabled. */
  private remove(adminUserId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(adminTotpCredentials)
        .where(eq(adminTotpCredentials.adminUserId, adminUserId))
        .returning({ id: adminTotpCredentials.adminUserId })
      await tx
        .delete(adminRecoveryCodes)
        .where(eq(adminRecoveryCodes.adminUserId, adminUserId))
      return removed.length > 0
    })
  }

  private async notify(
    adminUserId: string,
    change: 'enabled' | 'disabled' | 'reset',
  ): Promise<void> {
    const account = await this.accounts.findById('admin', adminUserId)
    if (account) {
      await this.mail.send(
        account.email,
        mailTemplates.twoFactorChanged({ nickname: account.nickname, change }),
      )
    }
  }

  private setupKey(adminUserId: string): string {
    return `auth:mfa-setup:admin:${adminUserId}`
  }

  private challengeKey(challengeToken: string): string {
    return `auth:mfa-challenge:admin:${sha256(challengeToken)}`
  }
}
