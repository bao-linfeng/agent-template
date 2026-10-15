import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Realm } from '../../modules/auth/realms.js';
import type { AppAbility } from '../../modules/rbac/ability.js';

/** Identity attached to the request by `JwtAuthGuard`. `id` is a `users` id or an `admin_users` id depending on `realm`. */
export interface AuthUser {
  id: string;
  email: string;
  sessionId: string;
  realm: Realm;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    /** Admin routes only; set lazily by `PoliciesGuard` / `RbacService.abilityForRequest`. */
    ability?: AppAbility;
  }
}

export type HttpRequest = FastifyRequest;
export type HttpReply = FastifyReply;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function requestMeta(request: HttpRequest): RequestMeta {
  const userAgent = request.headers['user-agent'];
  return {
    ip: request.ip,
    userAgent:
      typeof userAgent === 'string' ? userAgent.slice(0, 500) : undefined,
  };
}
