// Must stay the first import: loads .env before any module reads process.env.
import './config/load-env.js'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module.js'
import type { Env } from './config/env.js'
import { configureApp, createFastifyAdapter } from './setup-app.js'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(),
    { bufferLogs: true },
  )
  await configureApp(app)
  const config = app.get<ConfigService<Env, true>>(ConfigService)
  await app.listen(
    config.get('PORT', { infer: true }),
    config.get('HOST', { infer: true }),
  )
}
await bootstrap()
