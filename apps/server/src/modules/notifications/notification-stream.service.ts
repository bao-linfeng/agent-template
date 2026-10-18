import { PassThrough } from 'node:stream'
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { Gauge } from 'prom-client'
import type { AuthUser, HttpReply } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import { MetricsService } from '../../infra/metrics/metrics.service.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import { revokedSessionKey } from '../auth/auth.constants.js'
import { REALMS, type Realm } from '../auth/realms.js'
import type { NotificationView } from './notifications.service.js'

/**
 * Events on `GET /notifications/stream`. They are signals: clients refetch lists and counts instead of
 * keeping state from the stream, and after every (re)connect (`ready`) they refetch once, so nothing is
 * lost while disconnected.
 * - `ready`: connected (sent first);
 * - `notification`: a new personal notification (the full view, e.g. for a toast);
 * - `announcement`: an announcement of the realm was published, changed, withdrawn or deleted;
 * - `sync`: read state or preferences changed in another tab or device.
 */
export type StreamEvent =
  | { event: 'notification'; data: NotificationView }
  | { event: 'announcement'; data: { id: string } }
  | { event: 'sync'; data: { reason: 'read' | 'deleted' | 'preferences' } }

/** Comment line every `HEARTBEAT_MS`: keeps proxies from closing idle connections. */
export const HEARTBEAT_MS = 25_000
/** Reconnect delay suggested to `EventSource`-like clients (`retry:` field). */
export const RECONNECT_MS = 5_000
/** Per account and instance; opening another one closes the oldest (forgotten tabs). */
export const MAX_STREAMS_PER_ACCOUNT = 5
/** A client that stops reading is dropped instead of buffering its events in memory. */
const MAX_BUFFERED_BYTES = 64 * 1024

const accountChannel = (realm: Realm, accountId: string) =>
  `notifications:${realm}:${accountId}`
const BROADCAST_PREFIX = 'notifications:broadcast:'
const broadcastChannel = (realm: Realm) => `${BROADCAST_PREFIX}${realm}`

/** One server-sent event frame; `data` is single-line JSON. */
export function formatEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

interface OpenStream {
  realm: Realm
  sessionId: string
  channel: string
  output: PassThrough
  /** The stream ends then, like the access token it was opened with. */
  closeAt: number
  closed: boolean
}

/**
 * Server-sent event streams of signed-in accounts. Events are published on Redis
 * (`notifications:<realm>:<accountId>`, `notifications:broadcast:<realm>`), so they reach the streams on
 * every instance; each instance has one subscriber connection and subscribes to an account channel
 * while it holds a stream of that account.
 *
 * A stream is authenticated once, when it opens. It ends after `ACCESS_TOKEN_TTL_SECONDS` (an access
 * token outlives its session by no more than that either) and within `HEARTBEAT_MS` after its session
 * was revoked (logout, password change, disabled account); the client then reconnects, which refreshes
 * the session or signs it out.
 */
@Injectable()
export class NotificationStreamService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationStreamService.name)
  private readonly maxLifetimeMs: number
  private readonly streams = new Set<OpenStream>()
  private readonly byChannel = new Map<string, Set<OpenStream>>()
  private subscriber?: Redis
  private timer?: NodeJS.Timeout

  constructor(
    @InjectRedis() private readonly redis: Redis,
    config: ConfigService<Env, true>,
    metrics: MetricsService,
  ) {
    this.maxLifetimeMs =
      config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }) * 1000
    if (metrics.enabled) {
      const streams = this.streams
      new Gauge({
        name: 'notification_streams_open',
        help: 'Open notification event streams on this instance',
        labelNames: ['realm'],
        registers: [metrics.registry],
        collect() {
          for (const realm of REALMS) {
            this.set({ realm }, 0)
          }
          for (const stream of streams) {
            this.inc({ realm: stream.realm })
          }
        },
      })
    }
  }

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate()
    this.subscriber.on('error', (error: Error) =>
      this.logger.warn(`Notification subscriber: ${error.message}`),
    )
    this.subscriber.on('message', (channel: string, message: string) =>
      this.dispatch(channel, message),
    )
    await this.subscriber.subscribe(...REALMS.map(broadcastChannel))
    this.timer = setInterval(() => void this.sweep(), HEARTBEAT_MS).unref()
  }

  /** Ends every stream before the HTTP server closes, which would otherwise wait for them. */
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer)
    // Deleting the visited entry while iterating a Set is safe.
    for (const stream of this.streams) {
      this.close(stream)
    }
    await this.subscriber?.quit().catch(() => undefined)
  }

  /** Sends `event` to the account's streams on every instance. Never throws: clients catch up on their next fetch. */
  async publish(
    realm: Realm,
    accountId: string,
    event: StreamEvent,
  ): Promise<void> {
    await this.send(accountChannel(realm, accountId), event)
  }

  /** Sends `event` to every stream of the realms. */
  async broadcast(realms: readonly Realm[], event: StreamEvent): Promise<void> {
    await Promise.all(
      realms.map((realm) => this.send(broadcastChannel(realm), event)),
    )
  }

  /** Opens a stream for the signed-in account; the controller returns it as the response body. */
  async open(user: AuthUser, reply: HttpReply): Promise<PassThrough> {
    if (reply.raw.destroyed) {
      // The client left while the guards ran: `close` has fired already, so the stream would never end.
      return new PassThrough().end()
    }
    const channel = accountChannel(user.realm, user.id)
    const stream: OpenStream = {
      realm: user.realm,
      sessionId: user.sessionId,
      channel,
      output: new PassThrough(),
      closeAt: Date.now() + this.maxLifetimeMs,
      closed: false,
    }
    reply.raw.once('close', () => this.close(stream))

    let channelStreams = this.byChannel.get(channel)
    if (!channelStreams) {
      channelStreams = new Set()
      this.byChannel.set(channel, channelStreams)
    }
    channelStreams.add(stream)
    this.streams.add(stream)
    // Insertion order: the first one is the oldest.
    for (const old of channelStreams) {
      if (channelStreams.size <= MAX_STREAMS_PER_ACCOUNT) {
        break
      }
      this.close(old)
    }
    // Idempotent, and ordered with the UNSUBSCRIBE of a stream closing meanwhile on the same connection.
    await this.subscriber!.subscribe(channel)

    stream.output.write(`retry: ${RECONNECT_MS}\n\n`)
    this.write(stream, formatEvent('ready', {}))
    return stream.output
  }

  /** Ends expired streams and those of revoked sessions, pings the rest. Runs every `HEARTBEAT_MS`. */
  async sweep(): Promise<void> {
    const now = Date.now()
    const alive: OpenStream[] = []
    for (const stream of this.streams) {
      if (now >= stream.closeAt) {
        this.close(stream)
      } else {
        alive.push(stream)
      }
    }
    if (alive.length === 0) {
      return
    }
    const pipeline = this.redis.pipeline()
    for (const stream of alive) {
      pipeline.exists(revokedSessionKey(stream.realm, stream.sessionId))
    }
    const results = await pipeline.exec().catch((error: Error) => {
      this.logger.warn(`Session check failed: ${error.message}`)
      return null
    })
    alive.forEach((stream, index) => {
      if (results?.[index]?.[1] === 1) {
        this.close(stream)
      } else {
        this.write(stream, ': ping\n\n')
      }
    })
  }

  private async send(channel: string, event: StreamEvent): Promise<void> {
    try {
      await this.redis.publish(channel, JSON.stringify(event))
    } catch (error) {
      this.logger.warn(
        `Could not publish a notification event: ${(error as Error).message}`,
      )
    }
  }

  private dispatch(channel: string, message: string): void {
    let event: StreamEvent
    try {
      event = JSON.parse(message) as StreamEvent
    } catch {
      return
    }
    const frame = formatEvent(event.event, event.data)
    if (channel.startsWith(BROADCAST_PREFIX)) {
      const realm = channel.slice(BROADCAST_PREFIX.length)
      for (const stream of this.streams) {
        if (stream.realm === realm) {
          this.write(stream, frame)
        }
      }
      return
    }
    for (const stream of this.byChannel.get(channel) ?? []) {
      this.write(stream, frame)
    }
  }

  private write(stream: OpenStream, frame: string): void {
    if (stream.closed) {
      return
    }
    if (stream.output.writableLength > MAX_BUFFERED_BYTES) {
      this.close(stream)
      return
    }
    stream.output.write(frame)
  }

  private close(stream: OpenStream): void {
    if (stream.closed) {
      return
    }
    stream.closed = true
    this.streams.delete(stream)
    const channelStreams = this.byChannel.get(stream.channel)
    channelStreams?.delete(stream)
    if (channelStreams?.size === 0) {
      this.byChannel.delete(stream.channel)
      this.subscriber?.unsubscribe(stream.channel).catch(() => undefined)
    }
    stream.output.end()
  }
}
