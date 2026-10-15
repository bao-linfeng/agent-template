import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { SecretBox } from '../common/crypto/crypto.js';
import { SYSTEM_ROLES } from '../modules/rbac/permissions.js';
import type { Database } from './database.js';
import { embeddingModels, roles, userRoles, users } from './schema/index.js';

export interface SeedOptions {
  admin?: { email: string; password: string; nickname: string };
  embedding: {
    name: string;
    baseUrl: string;
    model: string;
    dimensions: number;
    apiKey?: string;
  };
  encryptionKey: string;
  passwordHashRounds: number;
}

/** Idempotent: creates system roles, the first super admin and the default embedding model when missing. */
export async function seedDatabase(
  db: Database,
  options: SeedOptions,
): Promise<string[]> {
  const log: string[] = [];

  for (const role of Object.values(SYSTEM_ROLES)) {
    const inserted = await db
      .insert(roles)
      .values({ ...role, permissions: [...role.permissions], isSystem: true })
      .onConflictDoNothing({ target: roles.code })
      .returning({ id: roles.id });
    if (inserted.length > 0) {
      log.push(`role ${role.code} created`);
    }
  }

  if (options.admin) {
    const email = options.admin.email.trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      log.push(`admin ${email} already exists`);
    } else {
      const superAdmin = await db.query.roles.findFirst({
        where: eq(roles.code, SYSTEM_ROLES.superAdmin.code),
      });
      await db.transaction(async (tx) => {
        const [admin] = await tx
          .insert(users)
          .values({
            email,
            nickname: options.admin!.nickname,
            passwordHash: await hash(
              options.admin!.password,
              options.passwordHashRounds,
            ),
          })
          .returning({ id: users.id });
        await tx
          .insert(userRoles)
          .values({ userId: admin!.id, roleId: superAdmin!.id });
      });
      log.push(`admin ${email} created with role super_admin`);
    }
  }

  const anyModel = await db.query.embeddingModels.findFirst();
  if (!anyModel) {
    const { apiKey, ...embedding } = options.embedding;
    await db.insert(embeddingModels).values({
      ...embedding,
      apiKeyEncrypted: apiKey
        ? new SecretBox(options.encryptionKey).encrypt(apiKey)
        : null,
      isDefault: true,
    });
    log.push(
      `default embedding model ${embedding.model} (${embedding.dimensions}d) created`,
    );
  }

  return log;
}
