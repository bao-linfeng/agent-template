import { createObserveModule } from '@nestjs/observe'

/**
 * NestJS Observe (https://observe.nestjs.com) is opt-in: set OBSERVE_APP_KEY and OBSERVE_APP_SECRET
 * to enable tracing/metrics. Without them the module is not loaded and nothing is sent.
 */
export const { ObserveModule, ObserveInstrument } = createObserveModule()

export const observeEnabled = Boolean(
  process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET,
)

export const observeImports = observeEnabled
  ? [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY!,
        appSecret: process.env.OBSERVE_APP_SECRET!,
        serviceId: 'agent-template-server',
      }),
    ]
  : []
