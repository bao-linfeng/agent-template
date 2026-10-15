import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppAbility } from '../../modules/rbac/ability.js';

/** Identity attached to the request by `JwtAuthGuard`. */
export interface AuthUser {
  id: string;
  email: string;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    /** Set lazily by `PoliciesGuard` / `RbacService.abilityFor`. */
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
