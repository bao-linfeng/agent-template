import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
  type ValidationError,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { AppException, type ErrorBody } from './app.exception.js'
import { codeForStatus, ERRORS, isErrorCode } from './error-codes.js'

export interface FieldError {
  /** Dotted property path, e.g. `items.0.name`. */
  field: string
  /** class-validator constraint name → English message. */
  constraints: Record<string, string>
}

/** Flattens nested class-validator errors into one entry per property. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent?: string,
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property
    const own = error.constraints
      ? [{ field, constraints: error.constraints }]
      : []
    return [...own, ...flattenValidationErrors(error.children ?? [], field)]
  })
}

/** `exceptionFactory` of the global ValidationPipe: 400 `VALIDATION_FAILED` with per-field `details`. */
export function validationException(errors: ValidationError[]): AppException {
  const details = flattenValidationErrors(errors)
  const messages = details.flatMap(({ constraints }) =>
    Object.values(constraints),
  )
  return new AppException('VALIDATION_FAILED', {
    message: messages.length ? messages.join('; ') : undefined,
    details,
  })
}

function messageOf(response: unknown, fallback: string): string {
  const message =
    typeof response === 'string'
      ? response
      : (response as { message?: unknown } | null)?.message
  if (Array.isArray(message) && message.length) {
    return message.join('; ')
  }
  return typeof message === 'string' && message ? message : fallback
}

/**
 * Maps anything thrown while handling a request to an `ErrorBody`: `AppException`s as built, other
 * `HttpException`s (throttler, Nest built-ins) and Fastify client errors get the generic code of their
 * status, everything else is a 500 that does not leak its message.
 */
export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof AppException) {
    return exception.getResponse()
  }
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus()
    const response = exception.getResponse()
    const explicit = (response as { code?: unknown } | null)?.code
    const code = isErrorCode(explicit) ? explicit : codeForStatus(statusCode)
    return {
      statusCode,
      code,
      message: messageOf(response, ERRORS[code].message),
    }
  }
  // Fastify errors (bad JSON, unsupported content type, body too large, ...) carry their status.
  const statusCode = (exception as { statusCode?: unknown } | null)?.statusCode
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    const code = codeForStatus(statusCode)
    return {
      statusCode,
      code,
      message: messageOf(exception, ERRORS[code].message),
    }
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: ERRORS.INTERNAL_ERROR.message,
  }
}

/** Global filter: every HTTP error response is an `ErrorBody`. Unexpected errors are logged. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler')

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>()
    const body = toErrorBody(exception)
    if (body.statusCode >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(exception)
    }
    if (reply.sent) {
      return
    }
    void reply.status(body.statusCode).send(body)
  }
}
