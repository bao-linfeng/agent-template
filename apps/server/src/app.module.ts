import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import type { Redis } from 'ioredis'
import { LoggerModule } from 'nestjs-pino'
import { CryptoModule } from './common/crypto/crypto.module.js'
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor.js'
import { RedisThrottlerStorage } from './common/throttling/redis-throttler.storage.js'
import { validateEnv, type Env } from './config/env.js'
import { DatabaseModule } from './database/database.module.js'
import { MailModule } from './infra/mail/mail.module.js'
import { QueueModule } from './infra/queue/queue.module.js'
import { REDIS, RedisModule } from './infra/redis/redis.module.js'
import { StorageModule } from './infra/storage/storage.module.js'
import { AccountsModule } from './modules/accounts/accounts.module.js'
import { AdminsModule } from './modules/admins/admins.module.js'
import { AiModule } from './modules/ai/ai.module.js'
import { AuditGuard, AuditInterceptor } from './modules/audit/audit.guard.js'
import { AuditModule } from './modules/audit/audit.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { AUTH_THROTTLE_KEY } from './modules/auth/decorators.js'
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard.js'
import { SecurityModule } from './modules/auth/security.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js'
import { RagModule } from './modules/rag/rag.module.js'
import { PoliciesGuard } from './modules/rbac/policies.js'
import { RbacModule } from './modules/rbac/rbac.module.js'
import { UsersModule } from './modules/users/users.module.js'
import { observeImports } from './observe.js'

@Module({
  imports: [
    // Env files are loaded by `config/load-env.ts`; here we only validate and type `process.env`.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // The request id comes from Fastify (`genReqId` in `createFastifyAdapter`); pino-http reuses `req.id`.
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
            ],
            censor: '[redacted]',
          },
          autoLogging: {
            ignore: (request) => request.url?.includes('/health') ?? false,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS],
      useFactory: (config: ConfigService<Env, true>, redis: Redis) => ({
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
          {
            // Only routes decorated with @AuthThrottle().
            name: 'auth',
            ttl:
              config.get('AUTH_THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
            skipIf: (context) =>
              !Reflect.getMetadata(AUTH_THROTTLE_KEY, context.getHandler()),
          },
        ],
      }),
    }),
    DatabaseModule,
    RedisModule,
    CryptoModule,
    StorageModule,
    QueueModule,
    MailModule,
    AuditModule,
    SecurityModule,
    RbacModule,
    AccountsModule,
    UsersModule,
    AdminsModule,
    AuthModule,
    AiModule,
    RagModule,
    MaintenanceModule,
    HealthModule,
    ...observeImports,
  ],
  providers: [
    // Order matters: audit context (never blocks) → rate limit → authenticate → authorize.
    { provide: APP_GUARD, useClass: AuditGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Only acts on routes decorated with @Idempotent(); inside the audit interceptor so replays are audited too.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
