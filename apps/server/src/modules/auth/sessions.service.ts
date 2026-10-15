import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
  randomToken,
  safeEqualHex,
  sha256,
} from '../../common/crypto/crypto.js';
import type { RequestMeta } from '../../common/http/request.js';
import type { Env } from '../../config/env.js';
import type { Database, DbExecutor } from '../../database/database.js';
import { InjectDb } from '../../database/database.module.js';
import { authSessions } from '../../database/schema/index.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';
import {
  revokedSessionKey,
  type AccessTokenPayload,
} from './auth.constants.js';

export interface IssuedTokens {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}

/** Concurrent refreshes (several tabs) may present the just-rotated token for this long without being treated as theft. */
const ROTATION_GRACE_MS = 30_000;

@Injectable()
export class SessionsService {
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', {
      infer: true,
    });
    this.refreshTtlSeconds = config.get('REFRESH_TOKEN_TTL_SECONDS', {
      infer: true,
    });
  }

  async create(
    user: { id: string; email: string },
    meta: RequestMeta,
    executor: DbExecutor = this.db,
  ): Promise<IssuedTokens> {
    const secret = randomToken();
    const [session] = await executor
      .insert(authSessions)
      .values({
        userId: user.id,
        refreshTokenHash: sha256(secret),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
        lastUsedAt: new Date(),
      })
      .returning({ id: authSessions.id });
    return this.issue(user, session!.id, secret);
  }

  /** Exchanges a refresh token for a new pair; the old refresh token stops working. */
  async rotate(
    refreshToken: string,
    meta: RequestMeta,
    loadUser: (
      userId: string,
    ) => Promise<{ id: string; email: string } | undefined>,
  ): Promise<IssuedTokens> {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.db.query.authSessions.findFirst({
      where: eq(authSessions.id, sessionId),
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    const presentedHash = sha256(secret);
    if (!safeEqualHex(presentedHash, session.refreshTokenHash)) {
      const withinGrace =
        session.previousRefreshTokenHash &&
        safeEqualHex(presentedHash, session.previousRefreshTokenHash) &&
        session.rotatedAt &&
        Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
      if (!withinGrace) {
        // A rotated-out token was replayed: assume it leaked and kill the session.
        await this.revoke(session.id);
      }
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const user = await loadUser(session.userId);
    if (!user) {
      await this.revoke(session.id);
      throw new UnauthorizedException('Account is not available');
    }

    const nextSecret = randomToken();
    const rotated = await this.db
      .update(authSessions)
      .set({
        refreshTokenHash: sha256(nextSecret),
        previousRefreshTokenHash: session.refreshTokenHash,
        rotatedAt: new Date(),
        lastUsedAt: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
      .where(
        and(
          eq(authSessions.id, session.id),
          eq(authSessions.refreshTokenHash, session.refreshTokenHash),
        ),
      )
      .returning({ id: authSessions.id });
    if (rotated.length === 0) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }
    return this.issue(user, session.id, nextSecret);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)),
      );
    await this.markRevoked([sessionId]);
  }

  /** Revokes every active session of a user, optionally keeping the current one. */
  async revokeAllForUser(
    userId: string,
    options: { exceptSessionId?: string } = {},
  ): Promise<void> {
    const conditions = [
      eq(authSessions.userId, userId),
      isNull(authSessions.revokedAt),
    ];
    if (options.exceptSessionId) {
      conditions.push(ne(authSessions.id, options.exceptSessionId));
    }
    const revoked = await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: authSessions.id });
    await this.markRevoked(revoked.map((row) => row.id));
  }

  listActive(userId: string) {
    return this.db
      .select({
        id: authSessions.id,
        ip: authSessions.ip,
        userAgent: authSessions.userAgent,
        createdAt: authSessions.createdAt,
        lastUsedAt: authSessions.lastUsedAt,
        expiresAt: authSessions.expiresAt,
      })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(authSessions.lastUsedAt));
  }

  async revokeOwn(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.db.query.authSessions.findFirst({
      where: and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
      ),
    });
    if (!session) {
      return false;
    }
    await this.revoke(session.id);
    return true;
  }

  private async issue(
    user: { id: string; email: string },
    sessionId: string,
    secret: string,
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      sid: sessionId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
    });
    return { sessionId, accessToken, refreshToken: `${sessionId}.${secret}` };
  }

  /** Access tokens live at most `accessTtlSeconds`, so the revocation marker can expire with them. */
  private async markRevoked(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) {
      return;
    }
    const pipeline = this.redis.pipeline();
    for (const id of sessionIds) {
      pipeline.set(revokedSessionKey(id), '1', 'EX', this.accessTtlSeconds);
    }
    await pipeline.exec();
  }
}
