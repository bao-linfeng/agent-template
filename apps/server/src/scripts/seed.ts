// Seeds system roles, the first super admin (SEED_ADMIN_*) and the default embedding model (SEED_EMBEDDING_*).
import '../config/load-env.js';
import { validateEnv } from '../config/env.js';
import { createDatabase, createPool } from '../database/database.js';
import { seedDatabase } from '../database/seed.js';

const env = validateEnv(process.env);
const pool = createPool(env.DATABASE_URL, 1);
try {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const log = await seedDatabase(createDatabase(pool), {
    admin:
      adminEmail && adminPassword
        ? {
            email: adminEmail,
            password: adminPassword,
            nickname: process.env.SEED_ADMIN_NICKNAME ?? 'Administrator',
          }
        : undefined,
    embedding: {
      name: process.env.SEED_EMBEDDING_NAME ?? 'bge-m3',
      baseUrl:
        process.env.SEED_EMBEDDING_BASE_URL ?? 'http://localhost:11434/v1',
      model: process.env.SEED_EMBEDDING_MODEL ?? 'bge-m3',
      dimensions: Number(process.env.SEED_EMBEDDING_DIMENSIONS ?? 1024),
      apiKey: process.env.SEED_EMBEDDING_API_KEY || undefined,
    },
    encryptionKey: env.ENCRYPTION_KEY,
    passwordHashRounds: env.PASSWORD_HASH_ROUNDS,
  });
  console.log(log.length > 0 ? log.join('\n') : 'Nothing to seed');
  if (!adminEmail || !adminPassword) {
    console.log(
      'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first super admin.',
    );
  }
} finally {
  await pool.end();
}
