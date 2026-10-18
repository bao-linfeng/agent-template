import { EventEmitter } from 'node:events'
import type { PassThrough } from 'node:stream'
import type { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import type { AuthUser, HttpReply } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import type { MetricsService } from '../../infra/metrics/metrics.service.js'
import {
  formatEvent,
  MAX_STREAMS_PER_ACCOUNT,
  NotificationStreamService,
} from './notification-stream.service.js'

/** In-memory stand-in for the shared client and its pub/sub duplicate. */
class FakeRedis extends EventEmitter {
  readonly channels = new Set<string>()
  readonly revoked = new Set<string>()
  subscriber?: FakeRedis
  private parent?: FakeRedis

  duplicate(): FakeRedis {
    const subscriber = new FakeRedis()
    subscriber.parent = this
    this.subscriber = subscriber
    return subscriber
  }

  async subscribe(...channels: string[]) {
    channels.forEach((channel) => this.channels.add(channel))
  }

  async unsubscribe(channel: string) {
    this.channels.delete(channel)
  }

  async publish(channel: string, message: string) {
    if (this.subscriber?.channels.has(channel)) {
      this.subscriber.emit('message', channel, message)
    }
    return 1
  }

  pipeline() {
    const keys: string[] = []
    const pipeline = {
      exists: (key: string) => {
        keys.push(key)
        return pipeline
      },
      exec: async () =>
        keys.map((key) => [null, this.revoked.has(key) ? 1 : 0]),
    }
    return pipeline
  }

  async quit() {
    return 'OK'
  }

  get root(): FakeRedis {
    return this.parent ?? this
  }
}

function setup(ttlSeconds = 900) {
  const redis = new FakeRedis()
  const config = { get: () => ttlSeconds } as unknown as ConfigService<
    Env,
    true
  >
  const metrics = { enabled: false } as MetricsService
  const service = new NotificationStreamService(
    redis as unknown as Redis,
    config,
    metrics,
  )
  return { redis, service }
}

function connect(service: NotificationStreamService, user: Partial<AuthUser>) {
  const raw = new EventEmitter()
  const reply = { raw } as unknown as HttpReply
  const account: AuthUser = {
    id: 'u1',
    email: 'u1@example.test',
    sessionId: 's1',
    realm: 'user',
    ...user,
  }
  return service.open(account, reply).then((output) => ({
    output,
    raw,
    read: () => readAll(output),
  }))
}

/** Text written so far. */
function readAll(output: PassThrough): string {
  let text = ''
  for (let chunk; (chunk = output.read() as Buffer | null) !== null;) {
    text += chunk.toString()
  }
  return text
}

describe('NotificationStreamService', () => {
  it('formats single-line JSON events', () => {
    expect(formatEvent('sync', { reason: 'read' })).toBe(
      'event: sync\ndata: {"reason":"read"}\n\n',
    )
  })

  it('sends events to the streams of the account and broadcasts to the realm', async () => {
    const { redis, service } = setup()
    await service.onModuleInit()
    const mine = await connect(service, { id: 'u1' })
    const other = await connect(service, { id: 'u2', sessionId: 's2' })
    const admin = await connect(service, {
      id: 'a1',
      sessionId: 's3',
      realm: 'admin',
    })
    expect(mine.read()).toBe('retry: 5000\n\nevent: ready\ndata: {}\n\n')
    other.read()
    admin.read()

    await service.publish('user', 'u1', {
      event: 'sync',
      data: { reason: 'read' },
    })
    expect(mine.read()).toBe(formatEvent('sync', { reason: 'read' }))
    expect(other.read()).toBe('')

    await service.broadcast(['user'], {
      event: 'announcement',
      data: { id: 'x' },
    })
    expect(mine.read()).toContain('event: announcement')
    expect(other.read()).toContain('event: announcement')
    expect(admin.read()).toBe('')

    // The last stream of an account unsubscribes its channel.
    expect(redis.subscriber!.channels.has('notifications:user:u2')).toBe(true)
    other.raw.emit('close')
    expect(redis.subscriber!.channels.has('notifications:user:u2')).toBe(false)
    await service.onModuleDestroy()
    expect(mine.output.writableEnded).toBe(true)
  })

  it('pings live streams and ends revoked and expired ones', async () => {
    const { redis, service } = setup(60)
    await service.onModuleInit()
    const live = await connect(service, { sessionId: 'live' })
    const revoked = await connect(service, { sessionId: 'gone' })
    live.read()
    revoked.read()
    redis.root.revoked.add('auth:revoked-session:user:gone')

    await service.sweep()
    expect(live.read()).toBe(': ping\n\n')
    expect(revoked.output.writableEnded).toBe(true)

    vi.useFakeTimers({ now: Date.now() + 61_000, toFake: ['Date'] })
    try {
      await service.sweep()
    } finally {
      vi.useRealTimers()
    }
    expect(live.output.writableEnded).toBe(true)
    await service.onModuleDestroy()
  })

  it('closes the oldest stream beyond the per-account limit', async () => {
    const { service } = setup()
    await service.onModuleInit()
    const streams = []
    for (let index = 0; index <= MAX_STREAMS_PER_ACCOUNT; index++) {
      streams.push(await connect(service, { sessionId: `s${index}` }))
    }
    expect(streams[0]!.output.writableEnded).toBe(true)
    expect(streams.slice(1).every((s) => !s.output.writableEnded)).toBe(true)
    await service.onModuleDestroy()
  })
})
