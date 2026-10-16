import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { randomToken, sha256 } from '../../common/crypto/crypto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { RequestMeta } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { mailTemplates } from '../../infra/mail/mail.templates.js'
import { MailService } from '../../infra/mail/mail.service.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import {
  AccountsService,
  normalizeEmail,
  type AccountRow,
} from '../accounts/accounts.service.js'
import type { AccessTokenPayload } from './auth.constants.js'
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SendRegisterCodeDto,
} from './dto/auth.dto.js'
import { PasswordHasher } from './password-hasher.service.js'
import { REALM_TABLES, type Realm } from './realms.js'
import { SessionsService, type IssuedTokens } from './sessions.service.js'
import { VerificationCodesService } from './verification-codes.service.js'

/** Timing hints for the client's "send again" countdown. */
export interface SentCode {
  /** Seconds until the code expires. */
  expiresIn: number
  /** Seconds until another code may be requested. */
  resendAfter: number
}

export interface AuthResult {
  tokens: IssuedTokens
  account: AccountRow
}

const RESET_REQUEST_COOLDOWN_SECONDS = 60

/**
 * Credential flows for both realms. An email only exists within its realm: signing in to the admin
 * console with a client account (or the other way round) fails like any unknown email.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly accounts: AccountsService,
    private readonly sessions: SessionsService,
    private readonly hasher: PasswordHasher,
    private readonly mail: MailService,
    private readonly codes: VerificationCodesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Emails a registration code to prove the client owns the address. Registered emails are a 409,
   * like `register` itself, so the form can tell users to sign in instead.
   */
  async sendRegisterCode(dto: SendRegisterCodeDto): Promise<SentCode> {
    const email = normalizeEmail(dto.email)
    if (await this.accounts.findByEmail('user', email)) {
      throw new AppException('ACCOUNT_EMAIL_TAKEN')
    }
    const { code, expiresIn, resendAfter } = await this.codes.issue(
      'user',
      'register',
      email,
    )
    await this.mail.send(
      email,
      mailTemplates.verificationCode({
        code,
        expiresInMinutes: Math.round(expiresIn / 60),
      }),
    )
    return { expiresIn, resendAfter }
  }

  /**
   * Client self-registration with an emailed code; signs the new user in. Admin accounts are created
   * by administrators.
   */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    await this.codes.consume('user', 'register', dto.email, dto.code)
    const account = await this.accounts.create('user', dto, undefined, {
      lastLoginAt: new Date(),
    })
    const tokens = await this.sessions.create('user', account, meta)
    return { tokens, account }
  }

  /**
   * Accounts with a pending deletion answer `AUTH_ACCOUNT_PENDING_DELETION` (with `params.scheduledAt`),
   * but only after the password matched, so the state of an account is not revealed to strangers.
   */
  async login(
    realm: Realm,
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const account = await this.verifyCredentials(realm, dto)
    if (account.deletionScheduledAt) {
      throw new AppException('AUTH_ACCOUNT_PENDING_DELETION', {
        params: { scheduledAt: account.deletionScheduledAt.toISOString() },
      })
    }
    return this.startSession(realm, account, meta)
  }

  /** Cancels a pending deletion with the account's credentials and signs in (plain login otherwise). */
  async restore(
    realm: Realm,
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const account = await this.verifyCredentials(realm, dto)
    const restored = account.deletionScheduledAt
      ? await this.accounts.cancelDeletion(realm, account.id)
      : account
    return this.startSession(realm, restored, meta)
  }

  private async verifyCredentials(
    realm: Realm,
    dto: LoginDto,
  ): Promise<AccountRow> {
    const account = await this.accounts.findByEmail(realm, dto.email)
    const valid = account
      ? await this.hasher.verify(dto.password, account.passwordHash)
      : await this.hasher.verifyAgainstDummy(dto.password)
    if (!account || !valid) {
      throw new AppException('AUTH_INVALID_CREDENTIALS')
    }
    if (account.status !== 'active') {
      throw new AppException('AUTH_ACCOUNT_DISABLED')
    }
    return account
  }

  private async startSession(
    realm: Realm,
    account: AccountRow,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const tokens = await this.sessions.create(realm, account, meta)
    await this.accounts.touchLastLogin(realm, account.id)
    return { tokens, account }
  }

  refresh(
    realm: Realm,
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    if (!refreshToken) {
      throw new AppException('AUTH_REFRESH_TOKEN_MISSING')
    }
    return this.sessions.rotate(realm, refreshToken, meta, async (id) => {
      const account = await this.accounts.findById(realm, id)
      return account?.status === 'active' && !account.deletionScheduledAt
        ? account
        : undefined
    })
  }

  /** Revokes the session identified by either token; never fails so the client can always sign out. */
  async logout(
    realm: Realm,
    accessToken: string | undefined,
    refreshToken: string | undefined,
  ): Promise<void> {
    if (accessToken) {
      try {
        const payload =
          await this.jwt.verifyAsync<AccessTokenPayload>(accessToken)
        if (payload.realm === realm) {
          await this.sessions.revoke(realm, payload.sid)
          return
        }
      } catch {
        // Expired or invalid: fall back to the refresh token.
      }
    }
    await this.sessions.revokeByRefreshToken(realm, refreshToken)
  }

  /**
   * Always resolves with the same response so callers cannot probe which emails exist.
   * Repeated requests for one address are rate limited.
   */
  async forgotPassword(
    realm: Realm,
    dto: ForgotPasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const resetUrl = this.resolveResetUrl(dto.resetUrl)
    const email = normalizeEmail(dto.email)
    const cooldown = await this.redis.set(
      `auth:password-reset:cooldown:${realm}:${sha256(email)}`,
      '1',
      'EX',
      RESET_REQUEST_COOLDOWN_SECONDS,
      'NX',
    )
    if (cooldown !== 'OK') {
      return
    }
    const account = await this.accounts.findByEmail(realm, email)
    if (!account || account.status !== 'active') {
      return
    }

    const { resetTokens } = REALM_TABLES[realm]
    const token = randomToken()
    const ttlSeconds = this.config.get('PASSWORD_RESET_TTL_SECONDS', {
      infer: true,
    })
    await this.db.transaction(async (tx) => {
      // Only the latest link stays valid.
      await tx
        .update(resetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(eq(resetTokens.userId, account.id), isNull(resetTokens.usedAt)),
        )
      await tx.insert(resetTokens).values({
        userId: account.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        requestIp: meta.ip,
      })
    })

    resetUrl.searchParams.set('token', token)
    await this.mail.send(
      account.email,
      mailTemplates.passwordReset({
        nickname: account.nickname,
        resetUrl: resetUrl.toString(),
        expiresInMinutes: Math.round(ttlSeconds / 60),
      }),
    )
    this.logger.log(`Password reset requested for ${realm} ${account.id}`)
  }

  /** Reset links may only point at the configured web apps, so the email cannot be turned into a phishing link. */
  private resolveResetUrl(requested: string | undefined): URL {
    const appWebUrl = this.config.get('APP_WEB_URL', { infer: true })
    if (!requested) {
      return new URL('/reset-password', appWebUrl)
    }
    const url = new URL(requested)
    const trusted = new Set(
      [appWebUrl, ...this.config.get('CORS_ORIGINS', { infer: true })]
        .filter((origin) => URL.canParse(origin))
        .map((origin) => new URL(origin).origin),
    )
    if (!trusted.has(url.origin)) {
      throw new AppException('AUTH_RESET_URL_UNTRUSTED')
    }
    url.hash = ''
    return url
  }

  /**
   * Consumes a reset token, sets the new password and signs out every session. Also works during a
   * pending deletion, so owners who forgot their password can still restore the account.
   */
  async resetPassword(realm: Realm, dto: ResetPasswordDto): Promise<void> {
    const { resetTokens } = REALM_TABLES[realm]
    const [consumed] = await this.db
      .update(resetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(resetTokens.tokenHash, sha256(dto.token)),
          isNull(resetTokens.usedAt),
          gt(resetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: resetTokens.userId })
    const account = consumed
      ? await this.accounts.findById(realm, consumed.userId)
      : undefined
    if (!account || account.status !== 'active') {
      throw new AppException('AUTH_RESET_TOKEN_INVALID')
    }
    await this.accounts.setPassword(realm, account, dto.password)
  }
}
