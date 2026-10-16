import { Global, Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { MetricsService } from './metrics.service.js'
import { PoolMetrics } from './pool-metrics.js'
import { QueueMetrics } from './queue-metrics.js'

/** Prometheus metrics (see `MetricsService`); HTTP metrics are recorded by `registerMetricsHook`. */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [MetricsService, QueueMetrics, PoolMetrics],
  exports: [MetricsService],
})
export class MetricsModule {}
