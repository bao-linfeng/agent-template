import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifyMultipart from '@fastify/multipart'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { ErrorResponseDto } from './common/errors/error-response.dto.js'
import { IDEMPOTENT_REPLAYED_HEADER } from './common/idempotency/idempotency.js'
import {
  AllExceptionsFilter,
  validationException,
} from './common/errors/exception.filter.js'
import type { Env } from './config/env.js'
import { registerAuditHook } from './modules/audit/audit.hook.js'
import { REALM_COOKIES } from './modules/auth/realms.js'

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    trustProxy:
      process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    // Request logging is handled by nestjs-pino.
    logger: false,
    // Accept the caller's `x-request-id` (bounded) or generate a UUID. Fastify stores it on the raw
    // request too, so the HTTP logs (pino-http) and the audit log use the same id.
    requestIdHeader: false,
    genReqId: (request: IncomingMessage) => {
      const incoming = request.headers['x-request-id']
      return typeof incoming === 'string' &&
        incoming.length > 0 &&
        incoming.length <= 100
        ? incoming
        : randomUUID()
    },
  })
}

/**
 * Applies every HTTP-level setting. Shared by `main.ts` and the e2e tests so both run the same stack.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const config = app.get<ConfigService<Env, true>>(ConfigService)
  const prefix = config.get('API_PREFIX', { infer: true })

  app.useLogger(app.get(Logger))
  app.enableShutdownHooks()

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      void reply.header('x-request-id', request.id)
    })
  await app.register(fastifyCookie)
  await app.register(fastifyHelmet, {
    // JSON API: no HTML to protect with CSP, and avatars must be embeddable by the web apps.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: config.get('UPLOAD_MAX_BYTES', { infer: true }),
      files: 1,
      fields: 10,
    },
  })

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    // @fastify/cors only allows GET,HEAD,POST by default; the web apps also PATCH/PUT/DELETE.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // Readable by browser code; request headers such as Idempotency-Key are reflected from the preflight.
    // Content-Disposition carries the file name of downloads such as data exports.
    exposedHeaders: [
      'x-request-id',
      IDEMPOTENT_REPLAYED_HEADER,
      'content-disposition',
    ],
  })
  app.setGlobalPrefix(prefix)
  // Realm controllers carry `version: API_VERSION` → `/<prefix>/v1/{client,admin}/...`; public routes stay unversioned.
  app.enableVersioning({ type: VersioningType.URI })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  )
  // Every error response is `{ statusCode, code, message, params?, details? }` (see common/errors).
  app.useGlobalFilters(new AllExceptionsFilter())
  // Audit trail of API requests (see modules/audit), written after each response.
  registerAuditHook(app)

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Agent Template API')
        .setDescription(
          'Cookie-authenticated API with two separate account realms: client users sign in via POST /v1/client/auth/login ' +
            '(all /v1/client routes), admin console accounts via POST /v1/admin/auth/login (all /v1/admin routes). ' +
            'The browser keeps the HttpOnly cookies. Non-browser client apps (mini-programs, native apps) send ' +
            'X-Auth-Transport: bearer to the client auth routes, receive the tokens in the body and authenticate ' +
            'with Authorization: Bearer <accessToken>.',
        )
        .setVersion('1.0')
        .addCookieAuth(REALM_COOKIES.user.access, undefined, 'user')
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'user-bearer')
        .addCookieAuth(REALM_COOKIES.admin.access, undefined, 'admin')
        .addGlobalResponse({
          status: 'default',
          description: 'Error; translate by `code`',
          type: ErrorResponseDto,
        })
        .build(),
    )
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      jsonDocumentUrl: `${prefix}/docs-json`,
    })
  }
}
