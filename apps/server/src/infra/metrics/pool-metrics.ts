import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import type { Pool } from 'pg'
import { Gauge } from 'prom-client'
import { PG_POOL } from '../../database/database.module.js'
import { MetricsService } from './metrics.service.js'

/** PostgreSQL pool usage; `pg_pool_waiting_requests` > 0 for a while means the pool is too small. */
@Injectable()
export class PoolMetrics implements OnModuleInit {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  onModuleInit(): void {
    if (!this.metrics.enabled) {
      return
    }
    const pool = this.pool
    const registers = [this.metrics.registry]
    new Gauge({
      name: 'pg_pool_connections',
      help: 'PostgreSQL pool connections by state',
      labelNames: ['state'],
      registers,
      collect() {
        this.set({ state: 'total' }, pool.totalCount)
        this.set({ state: 'idle' }, pool.idleCount)
      },
    })
    new Gauge({
      name: 'pg_pool_waiting_requests',
      help: 'Queries waiting for a free PostgreSQL connection',
      registers,
      collect() {
        this.set(pool.waitingCount)
      },
    })
    new Gauge({
      name: 'pg_pool_max_connections',
      help: 'Configured size of the PostgreSQL pool (DATABASE_POOL_MAX)',
      registers,
      collect() {
        this.set(pool.options.max ?? 10)
      },
    })
  }
}
