import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common'
import { ProxyTracerProvider, trace } from '@opentelemetry/api'

/**
 * Flushes buffered spans when the app shuts down (after HTTP, workers and connections closed). The SDK is
 * started by the preload (`src/tracing.ts`), outside Nest, so it is reached through the global provider.
 */
@Injectable()
export class TracingShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    const global = trace.getTracerProvider()
    const provider =
      global instanceof ProxyTracerProvider ? global.getDelegate() : global
    if ('shutdown' in provider && typeof provider.shutdown === 'function') {
      await (provider.shutdown as () => Promise<void>).call(provider)
    }
  }
}

@Module({ providers: [TracingShutdown] })
export class TracingModule {}
