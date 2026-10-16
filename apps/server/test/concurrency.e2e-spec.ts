import { setTimeout as sleep } from 'node:timers/promises'
import type { Redis } from 'ioredis'
import { sha256 } from '../src/common/crypto/crypto.js'
import { AppException } from '../src/common/errors/app.exception.js'
import { requestFingerprint } from '../src/common/idempotency/idempotency.js'
import { RedisLockService } from '../src/infra/redis/redis-lock.service.js'
import { REDIS } from '../src/infra/redis/redis.module.js'
import {
  CLIENT_API,
  createTestApp,
  registerUser,
  type TestApp,
} from './support/test-app.js'

describe('distributed locks and idempotency keys (e2e)', () => {
  let t: TestApp
  let locks: RedisLockService
  let redis: Redis

  beforeAll(async () => {
    t = await createTestApp()
    locks = t.app.get(RedisLockService)
    redis = t.app.get<Redis>(REDIS)
  })

  afterAll(async () => {
    await t.close()
  })

  describe('RedisLockService', () => {
    it('lets one holder in and only the holder release', async () => {
      const lock = await locks.acquire('e2e:exclusive')
      expect(await locks.tryAcquire('e2e:exclusive')).toBeNull()
      await expect(locks.acquire('e2e:exclusive')).rejects.toMatchObject({
        code: 'RESOURCE_LOCKED',
      })

      expect(await lock.release()).toBe(true)
      expect(await lock.release()).toBe(false)
      const next = await locks.acquire('e2e:exclusive')
      expect(await lock.extend()).toBe(false)
      await next.release()
    })

    it('frees expired leases and waits for busy locks', async () => {
      const stale = await locks.acquire('e2e:lease', { ttlMs: 200 })
      const waited = await locks.acquire('e2e:lease', { waitMs: 2_000 })
      // The stale holder can no longer touch the new holder's lock.
      expect(await stale.release()).toBe(false)
      expect(await redis.get('lock:e2e:lease')).toBe(waited.token)
      await waited.release()
    })

    it('serializes withLock tasks and renews the lease while they run', async () => {
      const events: string[] = []
      const task = (name: string) => async (signal: AbortSignal) => {
        events.push(`${name}:start`)
        await sleep(600) // Longer than ttlMs: only renewal keeps the lock.
        expect(signal.aborted).toBe(false)
        events.push(`${name}:end`)
        return name
      }
      const results = await Promise.all([
        locks.withLock('e2e:serial', task('a'), { ttlMs: 200 }),
        sleep(50).then(() =>
          locks.withLock('e2e:serial', task('b'), {
            ttlMs: 200,
            waitMs: 5_000,
          }),
        ),
      ])
      expect(results).toEqual(['a', 'b'])
      expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
      expect(await redis.exists('lock:e2e:serial')).toBe(0)
    })

    it('releases the lock when the task throws', async () => {
      await expect(
        locks.withLock('e2e:throws', async () => {
          throw new AppException('CONFLICT')
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      expect(await redis.exists('lock:e2e:throws')).toBe(0)
    })
  })

  describe('@Idempotent routes', () => {
    const url = `${CLIENT_API}/rag/knowledge-bases`

    async function countKnowledgeBases(ownerId: string, name: string) {
      const { rows } = await t.pool.query<{ count: string }>(
        'select count(*) from rag_knowledge_bases where owner_id = $1 and name = $2',
        [ownerId, name],
      )
      return Number(rows[0]!.count)
    }

    it('runs a request once and replays its response for retries', async () => {
      const { agent, user } = await registerUser(t)
      const first = await agent
        .post(url)
        .set('Idempotency-Key', 'create-kb-1')
        .send({ name: 'Once', chunkSize: 300 })
        .expect(201)
      expect(first.headers['idempotent-replayed']).toBeUndefined()

      // Same key and payload (in another key order) → stored response.
      const retry = await agent
        .post(url)
        .set('Idempotency-Key', 'create-kb-1')
        .send({ chunkSize: 300, name: 'Once' })
        .expect(201)
      expect(retry.headers['idempotent-replayed']).toBe('true')
      expect(retry.body).toEqual(first.body)
      expect(await countKnowledgeBases(user.id, 'Once')).toBe(1)

      // Without a key the route behaves as before.
      await agent.post(url).send({ name: 'Once' }).expect(201)
      expect(await countKnowledgeBases(user.id, 'Once')).toBe(2)
    })

    it('rejects a key reused for a different request', async () => {
      const { agent } = await registerUser(t)
      await agent
        .post(url)
        .set('Idempotency-Key', 'reused')
        .send({ name: 'First' })
        .expect(201)
      const response = await agent
        .post(url)
        .set('Idempotency-Key', 'reused')
        .send({ name: 'Second' })
        .expect(422)
      expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_MISMATCH' })
    })

    it('answers 409 while the first request is still running', async () => {
      const { agent, user } = await registerUser(t)
      // Simulate an identical request that is still in flight and holds the key.
      const record = `idempotency:user:${user.id}:${sha256('busy')}`
      await redis.hset(record, {
        fingerprint: requestFingerprint('POST', url, { name: 'Busy' }),
        state: 'processing',
        token: 'other',
      })
      await redis.pexpire(record, 10_000)
      const response = await agent
        .post(url)
        .set('Idempotency-Key', 'busy')
        .send({ name: 'Busy' })
        .expect(409)
      expect(response.body).toMatchObject({
        code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
      })
    })

    it('forgets failed requests and scopes keys per account', async () => {
      const owner = await registerUser(t)
      const other = await registerUser(t)
      await owner.agent
        .post(url)
        .set('Idempotency-Key', 'shared')
        .send({ name: 'Bad', chunkSize: 1 })
        .expect(400)
      // The failed attempt did not claim the key: a retry with the same body runs again.
      await owner.agent
        .post(url)
        .set('Idempotency-Key', 'shared')
        .send({ name: 'Bad', chunkSize: 1 })
        .expect(400)

      await owner.agent
        .post(url)
        .set('Idempotency-Key', 'shared')
        .send({ name: 'Mine' })
        .expect(201)
      const theirs = await other.agent
        .post(url)
        .set('Idempotency-Key', 'shared')
        .send({ name: 'Theirs' })
        .expect(201)
      expect(theirs.headers['idempotent-replayed']).toBeUndefined()
      expect(theirs.body.ownerId).toBe(other.user.id)
    })

    it('validates the header', async () => {
      const { agent } = await registerUser(t)
      const response = await agent
        .post(url)
        .set('Idempotency-Key', 'x'.repeat(300))
        .send({ name: 'Long key' })
        .expect(400)
      expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_INVALID' })
    })
  })
})
