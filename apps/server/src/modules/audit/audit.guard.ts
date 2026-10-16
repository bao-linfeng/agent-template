import {
  CanActivate,
  ExecutionContext,
  Injectable,
  type CallHandler,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { tap, type Observable } from 'rxjs'
import type { HttpRequest } from '../../common/http/request.js'
import { REALM_KEY } from '../auth/decorators.js'
import type { Realm } from '../auth/realms.js'
import { AUDIT_KEY, type AuditOptions } from './audit-context.js'

/**
 * First global guard: never blocks, only attaches the route's audit settings to the request, so that
 * requests rejected by the later guards (401, 403, 429) are still recorded by the `onResponse` hook.
 */
@Injectable()
export class AuditGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true
    }
    const handler = context.getHandler()
    const controller = context.getClass()
    const targets = [handler, controller]
    const options =
      this.reflector.getAllAndOverride<AuditOptions | undefined>(
        AUDIT_KEY,
        targets,
      ) ?? {}
    context.switchToHttp().getRequest<HttpRequest>().audit = {
      action: options.action ?? `${controller.name}.${handler.name}`,
      realm: this.reflector.getAllAndOverride<Realm | undefined>(
        REALM_KEY,
        targets,
      ),
      mode: options.mode ?? 'default',
      redact: options.redact ?? [],
    }
    return true
  }
}

/** Remembers the `id` of the record a handler returns (e.g. the created role) as the audit resource. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequest>()
    return next.handle().pipe(
      tap((result) => {
        const id = (result as { id?: unknown } | null | undefined)?.id
        if (request.audit && typeof id === 'string') {
          request.audit.resourceId ??= id
        }
      }),
    )
  }
}
