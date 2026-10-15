import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import {
  likePattern,
  pageOffset,
  type Paginated,
} from '../../common/dto/pagination.dto.js';
import type { Env } from '../../config/env.js';
import type { Database, DbExecutor } from '../../database/database.js';
import { InjectDb } from '../../database/database.module.js';
import { isUniqueViolation } from '../../database/errors.js';
import type { UserRow, UserStatus } from '../../database/schema/index.js';
import { mailTemplates } from '../../infra/mail/mail.templates.js';
import { MailService } from '../../infra/mail/mail.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { PasswordHasher } from '../auth/password-hasher.service.js';
import { REALM_TABLES, type Realm } from '../auth/realms.js';
import { SessionsService } from '../auth/sessions.service.js';
import { avatarKey, detectImageType } from './avatar.js';
import type {
  AdminUpdateAccountDto,
  CreateAccountDto,
  ListAccountsQueryDto,
  UpdateProfileDto,
} from './dto/account.dto.js';

/** A row of `users` or `admin_users` (same columns). */
export type AccountRow = UserRow;

export interface PublicAccount {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/**
 * Account operations shared by both realms (client `users`, admin console `admin_users`). Every method
 * takes the realm whose tables it works on; the two populations never see each other's rows.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private readonly avatarBaseUrl: string;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    private readonly sessions: SessionsService,
    private readonly hasher: PasswordHasher,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    const publicUrl = config
      .get('PUBLIC_URL', { infer: true })
      .replace(/\/$/, '');
    this.avatarBaseUrl = `${publicUrl}/${config.get('API_PREFIX', { infer: true })}/avatars`;
  }

  async findById(
    realm: Realm,
    id: string,
    executor: DbExecutor = this.db,
  ): Promise<AccountRow | undefined> {
    const { accounts } = REALM_TABLES[realm];
    const [row] = await executor
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);
    return row;
  }

  async findByEmail(
    realm: Realm,
    email: string,
  ): Promise<AccountRow | undefined> {
    const { accounts } = REALM_TABLES[realm];
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, normalizeEmail(email)))
      .limit(1);
    return row;
  }

  async getOrThrow(realm: Realm, id: string): Promise<AccountRow> {
    const account = await this.findById(realm, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async getPublic(realm: Realm, id: string): Promise<PublicAccount> {
    return this.toPublic(await this.getOrThrow(realm, id));
  }

  toPublic(account: AccountRow): PublicAccount {
    return {
      id: account.id,
      email: account.email,
      nickname: account.nickname,
      // Keys are immutable (`avatars/<accountId>/<uuid>.<ext>`), so the URL changes whenever the avatar does.
      avatarUrl: account.avatarKey
        ? `${this.avatarBaseUrl}/${account.avatarKey.slice('avatars/'.length)}`
        : null,
      status: account.status,
      lastLoginAt: account.lastLoginAt,
      createdAt: account.createdAt,
    };
  }

  /** Inserts an account; a duplicate email in the same realm is a 409. */
  async create(
    realm: Realm,
    dto: CreateAccountDto,
    executor: DbExecutor = this.db,
    extra: { lastLoginAt?: Date } = {},
  ): Promise<AccountRow> {
    const { accounts } = REALM_TABLES[realm];
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.hasher.hash(dto.password);
    try {
      const [created] = await executor
        .insert(accounts)
        .values({
          email,
          passwordHash,
          nickname: dto.nickname.trim(),
          lastLoginAt: extra.lastLoginAt,
        })
        .returning();
      return created!;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async touchLastLogin(realm: Realm, id: string): Promise<void> {
    const { accounts } = REALM_TABLES[realm];
    await this.db
      .update(accounts)
      .set({ lastLoginAt: new Date() })
      .where(eq(accounts.id, id));
  }

  async updateProfile(
    realm: Realm,
    id: string,
    dto: UpdateProfileDto,
  ): Promise<void> {
    const { accounts } = REALM_TABLES[realm];
    if (dto.nickname !== undefined) {
      await this.db
        .update(accounts)
        .set({ nickname: dto.nickname.trim() })
        .where(eq(accounts.id, id));
    }
  }

  async setAvatar(realm: Realm, id: string, buffer: Buffer): Promise<void> {
    const type = detectImageType(buffer);
    if (!type) {
      throw new UnsupportedMediaTypeException(
        'Avatar must be a PNG, JPEG, GIF or WebP image',
      );
    }
    const { accounts } = REALM_TABLES[realm];
    const account = await this.getOrThrow(realm, id);
    const key = avatarKey(id, `${randomUUID()}.${type.ext}`);
    await this.storage.putObject(key, buffer, type.mime);
    await this.db
      .update(accounts)
      .set({ avatarKey: key })
      .where(eq(accounts.id, id));
    await this.deleteObjectQuietly(account.avatarKey);
  }

  async removeAvatar(realm: Realm, id: string): Promise<void> {
    const { accounts } = REALM_TABLES[realm];
    const account = await this.getOrThrow(realm, id);
    await this.db
      .update(accounts)
      .set({ avatarKey: null })
      .where(eq(accounts.id, id));
    await this.deleteObjectQuietly(account.avatarKey);
  }

  /** Changes the password and signs out every other session. */
  async changePassword(
    realm: Realm,
    id: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.getOrThrow(realm, id);
    if (!(await this.hasher.verify(currentPassword, account.passwordHash))) {
      // 400, not 401: clients treat 401 as an expired session and would sign the user out.
      throw new BadRequestException('Current password is incorrect');
    }
    await this.setPassword(realm, account, newPassword, {
      exceptSessionId: sessionId,
    });
  }

  /** Shared by change-password and reset-password flows. */
  async setPassword(
    realm: Realm,
    account: AccountRow,
    newPassword: string,
    options: { exceptSessionId?: string } = {},
  ): Promise<void> {
    const { accounts } = REALM_TABLES[realm];
    await this.db
      .update(accounts)
      .set({ passwordHash: await this.hasher.hash(newPassword) })
      .where(eq(accounts.id, account.id));
    await this.sessions.revokeAllForUser(realm, account.id, options);
    await this.mail.send(
      account.email,
      mailTemplates.passwordChanged({ nickname: account.nickname }),
    );
  }

  // ---- Administration ----------------------------------------------------------------------

  /** `keyword` matches email or nickname. */
  async list(
    realm: Realm,
    query: ListAccountsQueryDto,
  ): Promise<Paginated<AccountRow>> {
    const { accounts } = REALM_TABLES[realm];
    const filters: SQL[] = [];
    if (query.keyword) {
      filters.push(
        or(
          ilike(accounts.email, likePattern(query.keyword)),
          ilike(accounts.nickname, likePattern(query.keyword)),
        )!,
      );
    }
    if (query.status) {
      filters.push(eq(accounts.status, query.status));
    }
    const where = filters.length > 0 ? and(...filters) : undefined;
    const [items, [totals]] = await Promise.all([
      this.db
        .select()
        .from(accounts)
        .where(where)
        .orderBy(desc(accounts.createdAt))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(accounts).where(where),
    ]);
    return {
      items,
      total: totals?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Nickname/status changes by an administrator; disabling signs the account out everywhere. */
  async adminUpdate(
    realm: Realm,
    id: string,
    dto: AdminUpdateAccountDto,
  ): Promise<void> {
    const { accounts } = REALM_TABLES[realm];
    const account = await this.getOrThrow(realm, id);
    await this.db
      .update(accounts)
      .set({ nickname: dto.nickname?.trim(), status: dto.status })
      .where(eq(accounts.id, id));
    if (dto.status === 'disabled' && account.status !== 'disabled') {
      await this.sessions.revokeAllForUser(realm, id);
    }
  }

  private async deleteObjectQuietly(key: string | null): Promise<void> {
    if (!key) {
      return;
    }
    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(`Failed to delete ${key}: ${(error as Error).message}`);
    }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
