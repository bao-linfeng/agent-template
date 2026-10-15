import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import type { Env } from './config/env.js';
import { ACCESS_TOKEN_COOKIE } from './modules/auth/auth.constants.js';

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    trustProxy:
      process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    // Request logging is handled by nestjs-pino.
    logger: false,
  });
}

/**
 * Applies every HTTP-level setting. Shared by `main.ts` and the e2e tests so both run the same stack.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const prefix = config.get('API_PREFIX', { infer: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    // JSON API: no HTML to protect with CSP, and avatars must be embeddable by the web apps.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: config.get('UPLOAD_MAX_BYTES', { infer: true }),
      files: 1,
      fields: 10,
    },
  });

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    // @fastify/cors only allows GET,HEAD,POST by default; the web apps also PATCH/PUT/DELETE.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Agent Template API')
        .setDescription(
          'Cookie-authenticated API. Sign in via POST /auth/login; the browser keeps the HttpOnly cookies.',
        )
        .setVersion('1.0')
        .addCookieAuth(ACCESS_TOKEN_COOKIE)
        .build(),
    );
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      jsonDocumentUrl: `${prefix}/docs-json`,
    });
  }
}
