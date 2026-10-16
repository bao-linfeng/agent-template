import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import {
  randomToken,
  safeEqualHex,
  sha256,
} from '../../common/crypto/crypto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { RequestMeta } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import type { Database, DbExecutor } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import type { NumberSettingKey } from '../settings/settings.catalog.js'
import { SettingsService } from '../settings/settings.service.js'
import { revokedSessionKey, type AccessTokenPayload } from './auth.constants.js'
import { REALM_TABLES, SLIDING_SESSION_REALMS, type Realm } from './realms.js'

export interface IssuedTokens {
  sessionId: string
  accessToken: string
  refreshToken: string
  /** Seconds until the session (and so the refresh token) expires. */
  refreshExpiresIn: number
}

/** Concurrent refreshes (several tabs) may present the just-rotated token for this long without being treated as theft. */
const ROTATION_GRACE_MS = 30_000

/**
 * Runtime settings holding each realm's session lifetime in seconds: `ttl` counts from now on every
 * (re)issue for sliding realms and from sign-in otherwise, `max` caps sliding sessions after sign-in.
 */
const SESSION_TTL_SETTINGS: Record<
  Realm,
  { ttl: NumberSettingKey; max?: NumberSettingKey }
> = {
  user: {
    ttl: 'session.clientIdleTtlSeconds',
    max: 'session.clientMaxTtlSeconds',
  },
  admin: { ttl: 'session.adminTtlSeconds' },
}

/** Login sessions of both realms; every method works on the session table of the given realm. */
@Injectable()
export class SessionsService {
  /**
   * Env-only on purpose: revocation markers live this long, so lowering it at runtime would let tokens
   * issued before the change outlive the marker of their revoked session.
   */
  readonly accessTtlSeconds: number

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', {
      infer: true,
    })
  }

  async create(
    realm: Realm,
    user: { id: string; email: string },
    meta: RequestMeta,
    executor: DbExecutor = this.db,
  ): Promise<IssuedTokens> {
    const { sessions } = REALM_TABLES[realm]
    const secret = randomToken()
    const expiresAt = this.nextExpiry(realm, new Date())
    const [session] = await executor
      .insert(sessions)
      .values({
        userId: user.id,
        refreshTokenHash: sha256(secret),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt,
        lastUsedAt: new Date(),
      })
      .returning({ id: sessions.id })
    return this.issue(realm, user, session!.id, secret, expiresAt)
  }

  /** Exchanges a refresh token for a new pair; the old refresh token stops working. */
  async rotate(
    realm: Realm,
    refreshToken: string,
    meta: RequestMeta,
    loadUser: (
      userId: string,
    ) => Promise<{ id: string; email: string } | undefined>,
  ): Promise<IssuedTokens> {
    const { sessions } = REALM_TABLES[realm]
    const [sessionId, secret] = refreshToken.split('.')
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) {
      throw new AppException('AUTH_REFRESH_TOKEN_INVALID')
    }
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppException('AUTH_SESSION_EXPIRED')
    }

    const presentedHash = sha256(secret)
    if (!safeEqualHex(presentedHash, session.refreshTokenHash)) {
      const withinGrace =
        session.previousRefreshTokenHash &&
        safeEqualHex(presentedHash, session.previousRefreshTokenHash) &&
        session.rotatedAt &&
        Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS
      if (!withinGrace) {
        // A rotated-out token was replayed: assume it leaked and kill the session.
        await this.revoke(realm, session.id)
      }
      throw new AppException('AUTH_REFRESH_TOKEN_INVALID')
    }

    const user = await loadUser(session.userId)
    if (!user) {
      await this.revoke(realm, session.id)
      throw new AppException('AUTH_ACCOUNT_UNAVAILABLE')
    }

    const nextSecret = randomToken()
    const expiresAt = SLIDING_SESSION_REALMS.has(realm)
      ? this.nextExpiry(realm, session.createdAt)
      : session.expiresAt
    const rotated = await this.db
      .update(sessions)
      .set({
        refreshTokenHash: sha256(nextSecret),
        previousRefreshTokenHash: session.refreshTokenHash,
        rotatedAt: new Date(),
        expiresAt,
        lastUsedAt: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
      .where(
        and(
          eq(sessions.id, session.id),
          eq(sessions.refreshTokenHash, session.refreshTokenHash),
        ),
      )
      .returning({ id: sessions.id })
    if (rotated.length === 0) {
      throw new AppException('AUTH_REFRESH_TOKEN_INVALID')
    }
    return this.issue(realm, user, session.id, nextSecret, expiresAt)
  }

  async revoke(realm: Realm, sessionId: string): Promise<void> {
    const { sessions } = REALM_TABLES[realm]
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
    await this.markRevoked(realm, [sessionId])
  }

  /** Revokes the session of a refresh token when the token matches; never throws (used by logout). */
  async revokeByRefreshToken(
    realm: Realm,
    refreshToken: string | undefined,
  ): Promise<void> {
    const [sessionId, secret] = refreshToken?.split('.') ?? []
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) {
      return
    }
    const { sessions } = REALM_TABLES[realm]
    const [session] = await this.db
      .select({ id: sessions.id, refreshTokenHash: sessions.refreshTokenHash })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
    if (session && safeEqualHex(sha256(secret), session.refreshTokenHash)) {
      await this.revoke(realm, session.id)
    }
  }

  /** Revokes every active session of a user, optionally keeping the current one. */
  async revokeAllForUser(
    realm: Realm,
    userId: string,
    options: { exceptSessionId?: string } = {},
  ): Promise<void> {
    const { sessions } = REALM_TABLES[realm]
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)]
    if (options.exceptSessionId) {
      conditions.push(ne(sessions.id, options.exceptSessionId))
    }
    const revoked = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: sessions.id })
    await this.markRevoked(
      realm,
      revoked.map((row) => row.id),
    )
  }

  listActive(realm: Realm, userId: string) {
    const { sessions } = REALM_TABLES[realm]
    return this.db
      .select({
        id: sessions.id,
        ip: sessions.ip,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        lastUsedAt: sessions.lastUsedAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastUsedAt))
  }

  async revokeOwn(
    realm: Realm,
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    const { sessions } = REALM_TABLES[realm]
    const [session] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
    if (!session) {
      return false
    }
    await this.revoke(realm, session.id)
    return true
  }

  private async issue(
    realm: Realm,
    user: { id: string; email: string },
    sessionId: string,
    secret: string,
    expiresAt: Date,
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      sid: sessionId,
      realm,
    }
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
    })
    return {
      sessionId,
      accessToken,
      refreshToken: `${sessionId}.${secret}`,
      refreshExpiresIn: Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      ),
    }
  }

  /**
   * End of a session (re)issued now: the realm's `ttl` setting from now, capped at its `max` setting
   * after sign-in for sliding realms (see `SLIDING_SESSION_REALMS`). Read on every call, so changed
   * settings apply to new sign-ins and the next refresh of sliding sessions.
   */
  private nextExpiry(realm: Realm, signedInAt: Date): Date {
    const lifetime = SESSION_TTL_SETTINGS[realm]
    const extended = Date.now() + this.settings.get(lifetime.ttl) * 1000
    if (!SLIDING_SESSION_REALMS.has(realm) || !lifetime.max) {
      return new Date(extended)
    }
    return new Date(
      Math.min(
        extended,
        signedInAt.getTime() + this.settings.get(lifetime.max) * 1000,
      ),
    )
  }

  /** Access tokens live at most `accessTtlSeconds`, so the revocation marker can expire with them. */
  private async markRevoked(realm: Realm, sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) {
      return
    }
    const pipeline = this.redis.pipeline()
    for (const id of sessionIds) {
      pipeline.set(
        revokedSessionKey(realm, id),
        '1',
        'EX',
        this.accessTtlSeconds,
      )
    }
    await pipeline.exec()
  }
}
