import { Redis } from 'ioredis';
import { RedisThrottlerStorage } from '../src/common/throttling/redis-throttler.storage.js';
import {
  API,
  createAdmin,
  createTestApp,
  E2E_ADMIN,
  loginAdmin,
  registerUser,
  type Agent,
  type TestApp,
} from './support/test-app.js';

describe('roles & permissions (e2e)', () => {
  let t: TestApp;
  let admin: Agent;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await loginAdmin(t, E2E_ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  async function roleId(code: string): Promise<string> {
    const roles = (await admin.get(`${API}/admin/roles`).expect(200)).body as {
      id: string;
      code: string;
    }[];
    return roles.find((role) => role.code === code)!.id;
  }

  it('keeps admin endpoints away from client users', async () => {
    const { agent } = await registerUser(t);
    await agent.get(`${API}/admin/users`).expect(401);
    await agent.get(`${API}/admin/roles`).expect(401);
    await agent.get(`${API}/admin/ai/embedding-models`).expect(401);
    await t.http().get(`${API}/admin/users`).expect(401);
  });

  it('lists client users with filters and pagination', async () => {
    const { user } = await registerUser(t, { nickname: 'Findable Person' });
    const page = await admin
      .get(`${API}/admin/users`)
      .query({ keyword: 'findable', pageSize: 5 })
      .expect(200);
    expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(page.body.items[0]).toMatchObject({ id: user.id });
    expect(page.body.items[0]).not.toHaveProperty('roles');
    expect(page.body.items[0]).not.toHaveProperty('passwordHash');

    // LIKE wildcards in the keyword are matched literally.
    const literal = await admin
      .get(`${API}/admin/users`)
      .query({ keyword: '%' })
      .expect(200);
    expect(literal.body.total).toBe(0);
    await admin.get(`${API}/admin/users`).query({ pageSize: 1000 }).expect(400);

    // Admin accounts are not client users.
    const admins = await admin
      .get(`${API}/admin/users`)
      .query({ keyword: E2E_ADMIN.email })
      .expect(200);
    expect(admins.body.total).toBe(0);
  });

  it('creates admin accounts that start without access', async () => {
    const { agent, admin: created, credentials } = await createAdmin(t, admin);
    await admin
      .post(`${API}/admin/admins`)
      .send({ ...credentials, nickname: 'Again' })
      .expect(409);
    await admin
      .post(`${API}/admin/admins`)
      .send({
        email: 'bad-role@e2e.test',
        password: 'password123',
        nickname: 'Bad',
        roleIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(400);

    const listed = await admin
      .get(`${API}/admin/admins`)
      .query({ keyword: credentials.email })
      .expect(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({ id: created.id, roles: [] }),
    ]);
    await agent.get(`${API}/admin/admins`).expect(403);
    await agent.get(`${API}/admin/users`).expect(403);

    // The built-in `admin` role may read but not create admin accounts.
    const { agent: operator } = await createAdmin(t, admin, {
      roleIds: [await roleId('admin')],
    });
    await operator.get(`${API}/admin/admins`).expect(200);
    await operator.get(`${API}/admin/users`).expect(200);
    await operator
      .post(`${API}/admin/admins`)
      .send({ email: 'x@e2e.test', password: 'password123', nickname: 'X' })
      .expect(403);
  });

  it('grants and revokes access through custom roles without stale caches', async () => {
    const { agent, admin: operator } = await createAdmin(t, admin);
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
    await admin
      .post(`${API}/admin/roles`)
      .send({
        code: 'legacy',
        name: 'Legacy',
        permissions: ['knowledge-base:create'],
      })
      .expect(400);

    await agent.get(`${API}/admin/users`).expect(403);
    await admin
      .put(`${API}/admin/admins/${operator.id}/roles`)
      .send({ roleIds: [created.body.id] })
      .expect(200);
    await agent.get(`${API}/admin/users`).expect(200);
    const { user } = await registerUser(t);
    await agent
      .patch(`${API}/admin/users/${user.id}`)
      .send({ nickname: 'Nope' })
      .expect(403);
    expect((await agent.get(`${API}/admin/me`)).body).toMatchObject({
      roles: ['auditor'],
      permissions: ['user:read'],
    });
    const roles = (await admin.get(`${API}/admin/roles`).expect(200)).body;
    expect(
      roles.find((role: { code: string }) => role.code === 'auditor'),
    ).toMatchObject({ userCount: 1 });

    await admin
      .patch(`${API}/admin/roles/${created.body.id}`)
      .send({ permissions: [] })
      .expect(200);
    await agent.get(`${API}/admin/users`).expect(403);

    await admin.delete(`${API}/admin/roles/${created.body.id}`).expect(204);
    expect((await agent.get(`${API}/admin/me`)).body.roles).toEqual([]);
  });

  it('lets administrators disable client users and other admins', async () => {
    const client = await registerUser(t);
    await admin
      .patch(`${API}/admin/users/${client.user.id}`)
      .send({ status: 'disabled' })
      .expect(200);
    await client.agent.get(`${API}/users/me`).expect(401);
    await t
      .http()
      .post(`${API}/auth/login`)
      .send(client.credentials)
      .expect(403);
    await admin
      .patch(`${API}/admin/users/${client.user.id}`)
      .send({ status: 'active' })
      .expect(200);
    await t
      .http()
      .post(`${API}/auth/login`)
      .send(client.credentials)
      .expect(200);

    const other = await createAdmin(t, admin);
    await admin
      .patch(`${API}/admin/admins/${other.admin.id}`)
      .send({ status: 'disabled' })
      .expect(200);
    await other.agent.get(`${API}/admin/me`).expect(401);
    await t
      .http()
      .post(`${API}/admin/auth/login`)
      .send(other.credentials)
      .expect(403);
  });

  it('protects system roles and the acting administrator', async () => {
    const superAdmin = await roleId('super_admin');
    const me = (await admin.get(`${API}/admin/me`).expect(200)).body as {
      id: string;
    };

    await admin.delete(`${API}/admin/roles/${superAdmin}`).expect(400);
    await admin
      .patch(`${API}/admin/roles/${superAdmin}`)
      .send({ permissions: ['user:read'] })
      .expect(400);
    await admin
      .put(`${API}/admin/admins/${me.id}/roles`)
      .send({ roleIds: [] })
      .expect(400);
    await admin
      .patch(`${API}/admin/admins/${me.id}`)
      .send({ status: 'disabled' })
      .expect(400);
    await admin
      .put(`${API}/admin/admins/${me.id}/roles`)
      .send({ roleIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);
  });

  it('serves the permission catalog for role editors', async () => {
    const catalog = await admin.get(`${API}/admin/permissions`).expect(200);
    expect(catalog.body).toContainEqual({
      code: 'admin:create',
      description: expect.any(String),
    });
    expect(catalog.body).not.toContainEqual(
      expect.objectContaining({ code: 'knowledge-base:create' }),
    );
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
