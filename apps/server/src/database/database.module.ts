import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Pool } from 'pg'
import type { Env } from '../config/env.js'
import { createDatabase, createPool } from './database.js'

export const PG_POOL = Symbol('PG_POOL')
export const DRIZZLE = Symbol('DRIZZLE')

/** Injects the Drizzle handle: `constructor(@InjectDb() private readonly db: Database) {}` */
export const InjectDb = () => Inject(DRIZZLE)

@Injectable()
class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('Database')
        return createPool(config.get('DATABASE_URL', { infer: true }), {
          max: config.get('DATABASE_POOL_MAX', { infer: true }),
          statementTimeoutMs: config.get('DATABASE_STATEMENT_TIMEOUT_MS', {
            infer: true,
          }),
          idleInTransactionTimeoutMs: config.get(
            'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS',
            { infer: true },
          ),
          connectionTimeoutMs: config.get('DATABASE_CONNECTION_TIMEOUT_MS', {
            infer: true,
          }),
          onError: (error) =>
            logger.error(`PostgreSQL connection error: ${error.message}`),
        })
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: createDatabase,
    },
    PoolShutdown,
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule {}
