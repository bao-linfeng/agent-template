import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, Wait } from 'testcontainers'
import type { TestProject } from 'vitest/node'
import {
  createDatabase,
  createPool,
  runMigrations,
} from '../../src/database/database.js'
import { seedDatabase } from '../../src/database/seed.js'
import { E2E_ADMIN } from '../support/constants.js'
import { startFakeEmbeddings } from '../support/fake-embeddings.js'

/** Starts throwaway Postgres (pgvector), Redis and RustFS containers plus a fake embeddings server. */
export default async function setup(project: TestProject) {
  const [postgres, redis, rustfs, embeddings] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg18')
      .withDatabase('app')
      .withUsername('app')
      .withPassword('app')
      .start(),
    new GenericContainer('redis:8-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start(),
    new GenericContainer('rustfs/rustfs:1.0.1')
      .withEnvironment({
        RUSTFS_ACCESS_KEY: 'e2e-access',
        RUSTFS_SECRET_KEY: 'e2e-secret-key',
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
    startFakeEmbeddings(),
  ])

  const env = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: postgres.getConnectionUri(),
    REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
    STORAGE_ENDPOINT: `http://${rustfs.getHost()}:${rustfs.getMappedPort(9000)}`,
    STORAGE_ACCESS_KEY: 'e2e-access',
    STORAGE_SECRET_KEY: 'e2e-secret-key',
    STORAGE_BUCKET: 'e2e',
    PASSWORD_HASH_ROUNDS: '4',
    AUTH_THROTTLE_LIMIT: '60',
    THROTTLE_LIMIT: '10000',
    PUBLIC_URL: 'http://localhost:3100',
    FAKE_EMBEDDINGS_URL: embeddings.baseUrl,
  }

  await runMigrations(env.DATABASE_URL)
  const pool = createPool(env.DATABASE_URL, 1)
  await seedDatabase(createDatabase(pool), {
    admin: E2E_ADMIN,
    embedding: {
      name: 'bge-m3',
      baseUrl: embeddings.baseUrl,
      model: 'bge-m3',
      dimensions: 1024,
    },
    encryptionKey: Buffer.alloc(32).toString('base64'),
    passwordHashRounds: 4,
  })
  await pool.end()

  project.provide('testEnv', env)

  return async () => {
    embeddings.server.close()
    await Promise.all([postgres.stop(), redis.stop(), rustfs.stop()])
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    testEnv: Record<string, string>
  }
}
