import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PG_POOL } from '../../src/database/database.module.js';
import {
  MAIL_TRANSPORT,
  type MailTransport,
} from '../../src/infra/mail/mail.processor.js';
import type { MailJob } from '../../src/infra/mail/mail.service.js';
import { configureApp, createFastifyAdapter } from '../../src/setup-app.js';

export { E2E_ADMIN } from './constants.js';

export const API = '/api';

export class Mailbox implements MailTransport {
  readonly sent: MailJob[] = [];

  async sendMail(message: MailJob): Promise<void> {
    this.sent.push(message);
  }

  to(address: string): MailJob[] {
    return this.sent.filter((mail) => mail.to === address);
  }
}

export interface TestApp {
  app: NestFastifyApplication;
  mailbox: Mailbox;
  pool: Pool;
  http: () => ReturnType<typeof request>;
  agent: () => ReturnType<typeof request.agent>;
  close: () => Promise<void>;
}

/** Boots the real AppModule on Fastify (same `configureApp` as production) with mail captured in memory. */
export async function createTestApp(): Promise<TestApp> {
  // Each test file starts with clean rate-limit counters and caches.
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.flushdb();
  await redis.quit();

  const mailbox = new Mailbox();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mailbox)
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    createFastifyAdapter(),
    { logger: false },
  );
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const server = app.getHttpServer();
  return {
    app,
    mailbox,
    pool: app.get<Pool>(PG_POOL),
    http: () => request(server),
    agent: () => request.agent(server),
    close: () => app.close(),
  };
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}@e2e.test`;
}

/** Registers a user through the API and returns a cookie-carrying agent. */
export async function registerUser(
  testApp: TestApp,
  overrides: { email?: string; password?: string; nickname?: string } = {},
) {
  const { nickname = 'Tester', ...rest } = overrides;
  const credentials = {
    email: uniqueEmail(),
    password: 'password123',
    ...rest,
  };
  const agent = testApp.agent();
  const response = await agent
    .post(`${API}/auth/register`)
    .send({ ...credentials, nickname })
    .expect(201);
  /** `credentials` is the login payload ({ email, password }). */
  return {
    agent,
    credentials,
    user: response.body as { id: string; email: string },
  };
}

export async function loginAdmin(
  testApp: TestApp,
  admin: { email: string; password: string },
) {
  const agent = testApp.agent();
  await agent
    .post(`${API}/auth/login`)
    .send({ email: admin.email, password: admin.password })
    .expect(200);
  return agent;
}

export function cookieValue(
  setCookie: string[] | string | undefined,
  name: string,
): string | undefined {
  const header = (
    Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  ).find((cookie) => cookie.startsWith(`${name}=`));
  return header?.slice(name.length + 1).split(';')[0];
}

export async function waitFor<T>(
  probe: () => Promise<T | undefined> | T | undefined,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined && value !== false) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for condition');
}
