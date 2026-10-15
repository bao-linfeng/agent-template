import { Redis } from 'ioredis';
import { RedisThrottlerStorage } from '../src/common/throttling/redis-throttler.storage.js';
import {
  API,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  type TestApp,
} from './support/test-app.js';

describe('roles & permissions (e2e)', () => {
  let t: TestApp;
  let admin: Awaited<ReturnType<typeof loginAdmin>>;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await loginAdmin(t, E2E_ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  it('keeps admin endpoints away from regular users', async () => {
    const { agent } = await registerUser(t);
    await agent.get(`${API}/admin/users`).expect(403);
    await agent.get(`${API}/admin/roles`).expect(403);
    await agent.get(`${API}/admin/ai/embedding-models`).expect(403);
    await t.http().get(`${API}/admin/users`).expect(401);
  });

  it('lists users with roles, filters and pagination', async () => {
    const { user } = await registerUser(t, { nickname: 'Findable Person' });
    const page = await admin
      .get(`${API}/admin/users`)
      .query({ keyword: 'findable', pageSize: 5 })
      .expect(200);
    expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(page.body.items[0]).toMatchObject({
      id: user.id,
      roles: [{ code: 'user' }],
    });

    // LIKE wildcards in the keyword are matched literally.
    const literal = await admin
      .get(`${API}/admin/users`)
      .query({ keyword: '%' })
      .expect(200);
    expect(literal.body.total).toBe(0);
    await admin.get(`${API}/admin/users`).query({ pageSize: 1000 }).expect(400);
  });

  it('grants and revokes access through custom roles without stale caches', async () => {
    const { agent, user } = await registerUser(t);
    const defaultRole = (
      await admin.get(`${API}/admin/roles`).expect(200)
    ).body.find((role: { code: string }) => role.code === 'user');

    const created = await admin
      .post(`${API}/admin/roles`)
      .send({ code: 'auditor', name: 'Auditor', permissions: ['user:read'] })
      .expect(201);
    await admin
      .post(`${API}/admin/roles`)
      .send({ code: 'auditor', name: 'Again', permissions: [] })
      .expect(409);
    await admin
      .post(`${API}/admin/roles`)
      .send({ code: 'bad', name: 'Bad', permissions: ['user:explode'] })
      .expect(400);

    await agent.get(`${API}/admin/users`).expect(403);
    await admin
      .put(`${API}/admin/users/${user.id}/roles`)
      .send({ roleIds: [defaultRole.id, created.body.id] })
      .expect(200);
    await agent.get(`${API}/admin/users`).expect(200);
    await agent
      .patch(`${API}/admin/users/${user.id}`)
      .send({ nickname: 'Nope' })
      .expect(403);
    expect((await agent.get(`${API}/users/me`)).body.roles).toEqual([
      'auditor',
      'user',
    ]);

    await admin
      .patch(`${API}/admin/roles/${created.body.id}`)
      .send({ permissions: [] })
      .expect(200);
    await agent.get(`${API}/admin/users`).expect(403);

    await admin.delete(`${API}/admin/roles/${created.body.id}`).expect(204);
    expect((await agent.get(`${API}/users/me`)).body.roles).toEqual(['user']);
  });

  it('protects system roles and the acting administrator', async () => {
    const roles = (await admin.get(`${API}/admin/roles`).expect(200)).body as {
      id: string;
      code: string;
    }[];
    const superAdmin = roles.find((role) => role.code === 'super_admin')!;
    const me = (await admin.get(`${API}/users/me`).expect(200)).body as {
      id: string;
    };

    await admin.delete(`${API}/admin/roles/${superAdmin.id}`).expect(400);
    await admin
      .patch(`${API}/admin/roles/${superAdmin.id}`)
      .send({ permissions: ['user:read'] })
      .expect(400);
    await admin
      .put(`${API}/admin/users/${me.id}/roles`)
      .send({ roleIds: [] })
      .expect(400);
    await admin
      .patch(`${API}/admin/users/${me.id}`)
      .send({ status: 'disabled' })
      .expect(400);
    await admin
      .put(`${API}/admin/users/${me.id}/roles`)
      .send({ roleIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);
  });

  it('serves the permission catalog for role editors', async () => {
    const catalog = await admin.get(`${API}/admin/permissions`).expect(200);
    expect(catalog.body).toContainEqual({
      code: 'user:read',
      description: expect.any(String),
    });
  });
});

describe('rate limiting (e2e)', () => {
  it('counts hits in Redis and blocks after the limit', async () => {
    const redis = new Redis(process.env.REDIS_URL!);
    try {
      const storage = new RedisThrottlerStorage(
        redis,
        `throttle-test-${Date.now()}`,
      );
      const first = await storage.increment('ip', 60_000, 2, 30_000, 'default');
      await storage.increment('ip', 60_000, 2, 30_000, 'default');
      const blocked = await storage.increment(
        'ip',
        60_000,
        2,
        30_000,
        'default',
      );
      expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
      expect(first.timeToExpire).toBeGreaterThan(55);
      expect(blocked).toMatchObject({ isBlocked: true });
      expect(blocked.timeToBlockExpire).toBeGreaterThan(25);
      expect(
        (await storage.increment('ip', 60_000, 2, 30_000, 'default')).isBlocked,
      ).toBe(true);
    } finally {
      await redis.quit();
    }
  });

  it('applies the stricter auth limit to credential endpoints only', async () => {
    const t = await createTestApp();
    try {
      const limit = Number(process.env.AUTH_THROTTLE_LIMIT);
      for (let i = 0; i < limit; i++) {
        await t
          .http()
          .post(`${API}/auth/forgot-password`)
          .send({ email: 'nobody@e2e.test' })
          .expect(202);
      }
      const limited = await t
        .http()
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'nobody@e2e.test' })
        .expect(429);
      expect(limited.headers['retry-after-auth']).toBeDefined();
      // Other routes only use the generous default limit.
      await t.http().get(`${API}/health/live`).expect(200);
      await t.http().post(`${API}/auth/refresh`).expect(401);
    } finally {
      await t.close();
    }
  });
});
