/**
 * OpenTelemetry preload: `node --import ./dist/tracing.js dist/main.js` (Dockerfile, `start:prod`). It runs
 * before the app imports pg/ioredis/pino so the instrumentations can patch them, which is why it lives
 * outside the Nest module graph. Does nothing unless an OTLP endpoint is configured (see `config/env.ts`).
 */
import './config/load-env.js'
import { register } from 'node:module'
import { createAddHookMessageChannel } from 'import-in-the-middle'
import { validateEnv, type Env } from './config/env.js'
import { createTracingSdk } from './infra/tracing/sdk.js'

async function startTracing(): Promise<void> {
  let env: Env
  try {
    env = validateEnv(process.env)
  } catch {
    // `main.ts` validates again and reports the configuration errors.
    return
  }
  if (!env.TRACING_ENABLED) {
    return
  }
  // ESM imports bypass `require` hooks: the loader wraps exactly the modules the instrumentations hook.
  // Must be registered before the instrumentations are created.
  const { registerOptions, waitForAllMessagesAcknowledged } =
    createAddHookMessageChannel()
  register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions)
  createTracingSdk(env)!.start()
  await waitForAllMessagesAcknowledged()
}

await startTracing()
