import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from 'drizzle-orm';
import {
  likePattern,
  pageOffset,
  type Paginated,
} from '../../common/dto/pagination.dto.js';
import type { Env } from '../../config/env.js';
import type { Database, DbExecutor } from '../../database/database.js';
import { InjectDb } from '../../database/database.module.js';
import {
  roles,
  userRoles,
  users,
  type UserRow,
  type UserStatus,
} from '../../database/schema/index.js';
import { mailTemplates } from '../../infra/mail/mail.templates.js';
import { MailService } from '../../infra/mail/mail.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { PasswordHasher } from '../auth/password-hasher.service.js';
import { SessionsService } from '../auth/sessions.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { avatarKey, detectImageType } from './avatar.js';
import type {
  AdminUpdateUserDto,
  ListUsersQueryDto,
  UpdateProfileDto,
} from './dto/user.dto.js';

export interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface UserProfile extends PublicUser {
  roles: string[];
  permissions: string[];
}

export interface AdminUserView extends PublicUser {
  roles: { id: string; code: string; name: string }[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly avatarBaseUrl: string;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    private readonly rbac: RbacService,
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

  findById(
    id: string,
    executor: DbExecutor = this.db,
  ): Promise<UserRow | undefined> {
    return executor.query.users.findFirst({ where: eq(users.id, id) });
  }

  findByEmail(email: string): Promise<UserRow | undefined> {
    return this.db.query.users.findFirst({
      where: eq(users.email, normalizeEmail(email)),
    });
  }

  async getOrThrow(id: string): Promise<UserRow> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  toPublicUser(user: UserRow): PublicUser {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      // Keys are immutable (`avatars/<userId>/<uuid>.<ext>`), so the URL changes whenever the avatar does.
      avatarUrl: user.avatarKey
        ? `${this.avatarBaseUrl}/${user.avatarKey.slice('avatars/'.length)}`
        : null,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.getOrThrow(userId);
    const access = await this.rbac.getUserAccess(userId);
    return { ...this.toPublicUser(user), ...access };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    if (dto.nickname !== undefined) {
      await this.db
        .update(users)
        .set({ nickname: dto.nickname.trim() })
        .where(eq(users.id, userId));
    }
    return this.getProfile(userId);
  }

  async setAvatar(userId: string, buffer: Buffer): Promise<UserProfile> {
    const type = detectImageType(buffer);
    if (!type) {
      throw new UnsupportedMediaTypeException(
        'Avatar must be a PNG, JPEG, GIF or WebP image',
      );
    }
    const user = await this.getOrThrow(userId);
    const key = avatarKey(userId, `${randomUUID()}.${type.ext}`);
    await this.storage.putObject(key, buffer, type.mime);
    await this.db
      .update(users)
      .set({ avatarKey: key })
      .where(eq(users.id, userId));
    await this.deleteObjectQuietly(user.avatarKey);
    return this.getProfile(userId);
  }

  async removeAvatar(userId: string): Promise<UserProfile> {
    const user = await this.getOrThrow(userId);
    await this.db
      .update(users)
      .set({ avatarKey: null })
      .where(eq(users.id, userId));
    await this.deleteObjectQuietly(user.avatarKey);
    return this.getProfile(userId);
  }

  /** Changes the password and signs out every other session. */
  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.getOrThrow(userId);
    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      // 400, not 401: clients treat 401 as an expired session and would sign the user out.
      throw new BadRequestException('Current password is incorrect');
    }
    await this.setPassword(user, newPassword, { exceptSessionId: sessionId });
  }

  /** Shared by change-password and reset-password flows. */
  async setPassword(
    user: UserRow,
    newPassword: string,
    options: { exceptSessionId?: string } = {},
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: await this.hasher.hash(newPassword) })
      .where(eq(users.id, user.id));
    await this.sessions.revokeAllForUser(user.id, options);
    await this.mail.send(
      user.email,
      mailTemplates.passwordChanged({ nickname: user.nickname }),
    );
  }

  // ---- Admin -------------------------------------------------------------------------------

  async list(query: ListUsersQueryDto): Promise<Paginated<AdminUserView>> {
    const filters: SQL[] = [];
    if (query.keyword) {
      filters.push(
        or(
          ilike(users.email, likePattern(query.keyword)),
          ilike(users.nickname, likePattern(query.keyword)),
        )!,
      );
    }
    if (query.status) {
      filters.push(eq(users.status, query.status));
    }
    const where = filters.length > 0 ? and(...filters) : undefined;
    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(users).where(where),
    ]);
    const rolesByUser = await this.rolesFor(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({
        ...this.toPublicUser(row),
        roles: rolesByUser.get(row.id) ?? [],
      })),
      total: totals?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async adminGet(id: string): Promise<AdminUserView> {
    const user = await this.getOrThrow(id);
    const rolesByUser = await this.rolesFor([id]);
    return { ...this.toPublicUser(user), roles: rolesByUser.get(id) ?? [] };
  }

  async adminUpdate(
    actorId: string,
    id: string,
    dto: AdminUpdateUserDto,
  ): Promise<AdminUserView> {
    const user = await this.getOrThrow(id);
    if (dto.status === 'disabled' && actorId === id) {
      throw new BadRequestException('You cannot disable your own account');
    }
    await this.db
      .update(users)
      .set({ nickname: dto.nickname?.trim(), status: dto.status })
      .where(eq(users.id, id));
    if (dto.status === 'disabled' && user.status !== 'disabled') {
      await this.sessions.revokeAllForUser(id);
    }
    return this.adminGet(id);
  }

  async setRoles(
    actorId: string,
    id: string,
    roleIds: string[],
  ): Promise<AdminUserView> {
    await this.getOrThrow(id);
    if (roleIds.length > 0) {
      const found = await this.db
        .select({ id: roles.id, code: roles.code })
        .from(roles)
        .where(inArray(roles.id, roleIds));
      if (found.length !== roleIds.length) {
        throw new BadRequestException('One or more roles do not exist');
      }
    }
    if (actorId === id) {
      // Prevent locking yourself out of the admin console by accident.
      const before = await this.rbac.getUserAccess(id);
      const superAdminId = await this.rbac.findRoleIdByCode('super_admin');
      if (
        before.roles.includes('super_admin') &&
        superAdminId &&
        !roleIds.includes(superAdminId)
      ) {
        throw new BadRequestException(
          'You cannot remove super_admin from yourself',
        );
      }
    }
    await this.db.transaction((tx) => this.rbac.assignRoles(id, roleIds, tx));
    await this.rbac.invalidateUser(id);
    return this.adminGet(id);
  }

  private async rolesFor(
    userIds: string[],
  ): Promise<Map<string, AdminUserView['roles']>> {
    const result = new Map<string, AdminUserView['roles']>();
    if (userIds.length === 0) {
      return result;
    }
    const rows = await this.db
      .select({
        userId: userRoles.userId,
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(inArray(userRoles.userId, userIds));
    for (const { userId, ...role } of rows) {
      result.set(userId, [...(result.get(userId) ?? []), role]);
    }
    return result;
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
