import type { HttpRequest } from '../../common/http/request.js'
import {
  REDACTED,
  sanitize,
  sanitizeRecord,
  shouldRecord,
  type AuditContext,
} from './audit-context.js'
import { buildAuditEntry } from './audit-entry.js'

describe('shouldRecord', () => {
  it('records writes by default and reads only when enabled', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(shouldRecord(method, 200, 'default', false)).toBe(true)
    }
    expect(shouldRecord('GET', 200, 'default', false)).toBe(false)
    expect(shouldRecord('GET', 403, 'default', false)).toBe(false)
    expect(shouldRecord('GET', 200, 'default', true)).toBe(true)
  })

  it('honours route modes', () => {
    expect(shouldRecord('GET', 200, 'always', false)).toBe(true)
    expect(shouldRecord('POST', 200, 'never', true)).toBe(false)
    expect(shouldRecord('POST', 204, 'failures', true)).toBe(false)
    expect(shouldRecord('POST', 401, 'failures', false)).toBe(true)
  })
})

describe('sanitize', () => {
  it('redacts secret-looking keys at any depth but keeps cleared values', () => {
    expect(
      sanitize({
        email: 'a@b.c',
        password: 'p',
        currentPassword: 'p',
        newPassword: 'p',
        refreshToken: 't',
        apiKey: 'sk-1',
        nested: { api_key: 'x', clientSecret: 'y', ok: 1 },
        list: [{ token: 'z' }],
      }),
    ).toEqual({
      email: 'a@b.c',
      password: REDACTED,
      currentPassword: REDACTED,
      newPassword: REDACTED,
      refreshToken: REDACTED,
      apiKey: REDACTED,
      nested: { api_key: REDACTED, clientSecret: REDACTED, ok: 1 },
      list: [{ token: REDACTED }],
    })
    // Clearing a credential stays visible.
    expect(sanitize({ apiKey: null, password: '' })).toEqual({
      apiKey: null,
      password: '',
    })
  })

  it('redacts extra keys of the route', () => {
    expect(sanitize({ code: '123456', name: 'x' }, new Set(['code']))).toEqual({
      code: REDACTED,
      name: 'x',
    })
  })

  it('truncates long strings, long arrays and deep nesting', () => {
    const text = sanitize('a'.repeat(1500)) as string
    expect(text.startsWith('a'.repeat(1000))).toBe(true)
    expect(text.endsWith('…[+500 chars]')).toBe(true)

    const list = sanitize(Array.from({ length: 60 }, (_, i) => i)) as unknown[]
    expect(list).toHaveLength(51)
    expect(list.at(-1)).toBe('…[+10 items]')

    let deep: Record<string, unknown> = { leaf: true }
    for (let i = 0; i < 10; i++) {
      deep = { child: deep }
    }
    expect(JSON.stringify(sanitize(deep))).toContain('[truncated]')
  })

  it('replaces non-plain objects with a marker', () => {
    expect(sanitize(Buffer.from('x'))).toBe('[Buffer]')
    expect(sanitize(new Date(0))).toBe('1970-01-01T00:00:00.000Z')
    expect(sanitize(undefined)).toBeNull()
  })

  it('returns null for empty or non-object records', () => {
    expect(sanitizeRecord({})).toBeNull()
    expect(sanitizeRecord(undefined)).toBeNull()
    expect(
      sanitizeRecord(Object.assign(Object.create(null), { a: '1' })),
    ).toEqual({ a: '1' })
  })
})

describe('buildAuditEntry', () => {
  function fakeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
    const audit: AuditContext = {
      action: 'RolesController.update',
      realm: 'admin',
      mode: 'default',
      redact: [],
    }
    return {
      method: 'PATCH',
      url: '/api/v1/admin/roles/1e9f?x=1',
      routeOptions: { url: '/api/v1/admin/roles/:id' },
      params: { id: '1e9f' },
      query: {},
      body: { name: 'Editors', password: 'secret' },
      headers: { 'user-agent': 'vitest' },
      ip: '127.0.0.1',
      id: 'req-1',
      user: {
        id: 'admin-id',
        email: 'root@example.com',
        sessionId: 's',
        realm: 'admin',
      },
      audit,
      ...overrides,
    } as unknown as HttpRequest
  }

  it('describes the request, actor and outcome', () => {
    const entry = buildAuditEntry(
      fakeRequest(),
      { statusCode: 200, durationMs: 12.6 },
      false,
    )
    expect(entry).toEqual({
      realm: 'admin',
      actorId: 'admin-id',
      actorEmail: 'root@example.com',
      action: 'RolesController.update',
      method: 'PATCH',
      route: '/api/v1/admin/roles/:id',
      path: '/api/v1/admin/roles/1e9f',
      resourceId: '1e9f',
      params: { id: '1e9f' },
      query: null,
      body: { name: 'Editors', password: REDACTED },
      statusCode: 200,
      errorCode: null,
      durationMs: 13,
      ip: '127.0.0.1',
      userAgent: 'vitest',
      requestId: 'req-1',
      createdAt: expect.any(Date),
    })
  })

  it('copies router params that are not plain objects', () => {
    class Params {
      id = 'from-router'
    }
    const entry = buildAuditEntry(
      fakeRequest({ params: new Params() }),
      { statusCode: 204, durationMs: 1 },
      false,
    )
    expect(entry).toMatchObject({
      params: { id: 'from-router' },
      resourceId: 'from-router',
    })
  })

  it('skips requests that never reached a route or are not audited', () => {
    expect(
      buildAuditEntry(
        fakeRequest({ audit: undefined }),
        { statusCode: 404, durationMs: 1 },
        true,
      ),
    ).toBeUndefined()
    expect(
      buildAuditEntry(
        fakeRequest({ method: 'GET' }),
        { statusCode: 200, durationMs: 1 },
        false,
      ),
    ).toBeUndefined()
  })

  it('falls back to the submitted email and the returned id on public routes', () => {
    const request = fakeRequest({
      method: 'POST',
      params: {},
      user: undefined,
      body: { email: ' Someone@Example.com ', password: 'x' },
    })
    request.audit!.resourceId = 'created-id'
    request.audit!.errorCode = 'AUTH_INVALID_CREDENTIALS'
    const entry = buildAuditEntry(
      request,
      { statusCode: 401, durationMs: 3 },
      false,
    )
    expect(entry).toMatchObject({
      actorId: null,
      actorEmail: 'someone@example.com',
      resourceId: 'created-id',
      errorCode: 'AUTH_INVALID_CREDENTIALS',
      statusCode: 401,
    })
  })
})
