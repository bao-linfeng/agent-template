import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, Wait } from 'testcontainers'
import type { TestProject } from 'vitest/node'
import {
  createDatabase,
  createPool,
  runMigrations,
} from '../../src/database/database.js'
import { seedDatabase } from '../../src/database/seed.js'
import { E2E_ADMIN, E2E_PREVIOUS_ENCRYPTION_KEY } from '../support/constants.js'
import { startFakeClamd } from '../support/fake-clamd.js'
import { startFakeEmbeddings } from '../support/fake-embeddings.js'

/** Starts throwaway Postgres (pgvector), Redis and Silo containers plus fake embeddings and clamd servers. */
export default async function setup(project: TestProject) {
  const [postgres, redis, silo, embeddings, clamd] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg18')
      .withDatabase('app')
      .withUsername('app')
      .withPassword('app')
      .start(),
    new GenericContainer('redis:8-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start(),
    new GenericContainer('pgsty/silo:RELEASE.2026-09-16T00-00-00Z')
      .withCommand(['server', '/data', '--console-address', ':9001'])
      .withEnvironment({
        MINIO_ROOT_USER: 'e2e-access',
        MINIO_ROOT_PASSWORD: 'e2e-secret-key',
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000))
      .start(),
    startFakeEmbeddings(),
    startFakeClamd(),
  ])

  const env = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: postgres.getConnectionUri(),
    REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
    STORAGE_ENDPOINT: `http://${silo.getHost()}:${silo.getMappedPort(9000)}`,
    STORAGE_PUBLIC_ENDPOINT: `http://${silo.getHost()}:${silo.getMappedPort(9000)}`,
    STORAGE_ACCESS_KEY: 'e2e-access',
    STORAGE_SECRET_KEY: 'e2e-secret-key',
    STORAGE_BUCKET: 'e2e',
    PASSWORD_HASH_ROUNDS: '4',
    AUTH_THROTTLE_LIMIT: '150',
    THROTTLE_LIMIT: '10000',
    PUBLIC_URL: 'http://localhost:3020',
    // A rotated-out key that still decrypts (see test/secret-rotation.e2e-spec.ts).
    ENCRYPTION_KEYS_PREVIOUS: E2E_PREVIOUS_ENCRYPTION_KEY,
    // Every test app binds its own metrics listener on a free port.
    METRICS_PORT: '0',
    FAKE_EMBEDDINGS_URL: embeddings.baseUrl,
    // Every upload goes through the malware scan (see FAKE_MALWARE / FAKE_SCAN_ERROR).
    CLAMAV_HOST: clamd.host,
    CLAMAV_PORT: String(clamd.port),
  }

  await runMigrations(env.DATABASE_URL)
  const pool = createPool(env.DATABASE_URL, { max: 1 })
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
    await clamd.close()
    await Promise.all([postgres.stop(), redis.stop(), silo.stop()])
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    testEnv: Record<string, string>
  }
}
