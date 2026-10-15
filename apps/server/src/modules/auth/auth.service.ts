import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
  randomToken,
  safeEqualHex,
  sha256,
} from '../../common/crypto/crypto.js';
import type { RequestMeta } from '../../common/http/request.js';
import type { Env } from '../../config/env.js';
import type { Database } from '../../database/database.js';
import { InjectDb } from '../../database/database.module.js';
import { isUniqueViolation } from '../../database/errors.js';
import {
  authSessions,
  passwordResetTokens,
  users,
  type UserRow,
} from '../../database/schema/index.js';
import { mailTemplates } from '../../infra/mail/mail.templates.js';
import { MailService } from '../../infra/mail/mail.service.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';
import { DEFAULT_ROLE_CODE } from '../rbac/permissions.js';
import { RbacService } from '../rbac/rbac.service.js';
import {
  normalizeEmail,
  UsersService,
  type UserProfile,
} from '../users/users.service.js';
import type { AccessTokenPayload } from './auth.constants.js';
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { SessionsService, type IssuedTokens } from './sessions.service.js';

export interface AuthResult {
  tokens: IssuedTokens;
  user: UserProfile;
}

const RESET_REQUEST_COOLDOWN_SECONDS = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly hasher: PasswordHasher,
    private readonly rbac: RbacService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Creates the account with the default role and signs the user in. */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await this.hasher.hash(dto.password);
    const defaultRoleId = await this.rbac.findRoleIdByCode(DEFAULT_ROLE_CODE);

    let user: UserRow;
    try {
      user = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            nickname: dto.nickname.trim(),
            lastLoginAt: new Date(),
          })
          .returning();
        if (defaultRoleId) {
          await this.rbac.assignRoles(created!.id, [defaultRoleId], tx);
        }
        return created!;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    const tokens = await this.sessions.create(user, meta);
    return { tokens, user: await this.users.getProfile(user.id) };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    const valid = user
      ? await this.hasher.verify(dto.password, user.passwordHash)
      : await this.hasher.verifyAgainstDummy(dto.password);
    if (!user || !valid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('This account has been disabled');
    }
    const tokens = await this.sessions.create(user, meta);
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return { tokens, user: await this.users.getProfile(user.id) };
  }

  refresh(
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    return this.sessions.rotate(refreshToken, meta, async (userId) => {
      const user = await this.users.findById(userId);
      return user?.status === 'active' ? user : undefined;
    });
  }

  /** Revokes the session identified by either cookie; never fails so the client can always sign out. */
  async logout(
    accessToken: string | undefined,
    refreshToken: string | undefined,
  ): Promise<void> {
    if (accessToken) {
      try {
        const payload =
          await this.jwt.verifyAsync<AccessTokenPayload>(accessToken);
        await this.sessions.revoke(payload.sid);
        return;
      } catch {
        // Expired or invalid: fall back to the refresh token.
      }
    }
    const [sessionId, secret] = refreshToken?.split('.') ?? [];
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) {
      return;
    }
    const session = await this.db.query.authSessions.findFirst({
      where: eq(authSessions.id, sessionId),
    });
    if (session && safeEqualHex(sha256(secret), session.refreshTokenHash)) {
      await this.sessions.revoke(session.id);
    }
  }

  /**
   * Always resolves with the same response so callers cannot probe which emails exist.
   * Repeated requests for one address are rate limited.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const resetUrl = this.resolveResetUrl(dto.resetUrl);
    const email = normalizeEmail(dto.email);
    const cooldown = await this.redis.set(
      `auth:password-reset:cooldown:${sha256(email)}`,
      '1',
      'EX',
      RESET_REQUEST_COOLDOWN_SECONDS,
      'NX',
    );
    if (cooldown !== 'OK') {
      return;
    }
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== 'active') {
      return;
    }

    const token = randomToken();
    const ttlSeconds = this.config.get('PASSWORD_RESET_TTL_SECONDS', {
      infer: true,
    });
    await this.db.transaction(async (tx) => {
      // Only the latest link stays valid.
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt),
          ),
        );
      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        requestIp: meta.ip,
      });
    });

    resetUrl.searchParams.set('token', token);
    await this.mail.send(
      user.email,
      mailTemplates.passwordReset({
        nickname: user.nickname,
        resetUrl: resetUrl.toString(),
        expiresInMinutes: Math.round(ttlSeconds / 60),
      }),
    );
    this.logger.log(`Password reset requested for user ${user.id}`);
  }

  /** Reset links may only point at the configured web apps, so the email cannot be turned into a phishing link. */
  private resolveResetUrl(requested: string | undefined): URL {
    const appWebUrl = this.config.get('APP_WEB_URL', { infer: true });
    if (!requested) {
      return new URL('/reset-password', appWebUrl);
    }
    const url = new URL(requested);
    const trusted = new Set(
      [appWebUrl, ...this.config.get('CORS_ORIGINS', { infer: true })]
        .filter((origin) => URL.canParse(origin))
        .map((origin) => new URL(origin).origin),
    );
    if (!trusted.has(url.origin)) {
      throw new BadRequestException('resetUrl must point to a trusted web app');
    }
    url.hash = '';
    return url;
  }

  /** Consumes a reset token, sets the new password and signs out every session. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const [consumed] = await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, sha256(dto.token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    const user = consumed
      ? await this.users.findById(consumed.userId)
      : undefined;
    if (!user || user.status !== 'active') {
      throw new BadRequestException('Reset link is invalid or has expired');
    }
    await this.users.setPassword(user, dto.password);
  }
}
