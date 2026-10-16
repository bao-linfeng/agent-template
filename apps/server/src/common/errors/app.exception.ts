import { HttpException } from '@nestjs/common'
import { ERRORS, type ErrorCode } from './error-codes.js'

export type ErrorParams = Record<string, string | number>

/** JSON body of every error response. */
export interface ErrorBody {
  statusCode: number
  /** Machine-readable code from `ERRORS`; clients translate by it. */
  code: ErrorCode
  /** English message for logs and clients without a translation. */
  message: string
  /** Values a translation may interpolate (e.g. `{ maxBytes }`). */
  params?: ErrorParams
  /** Structured extra data, e.g. the field errors of `VALIDATION_FAILED`. */
  details?: unknown
}

export interface AppExceptionOptions {
  /** Overrides the catalog message (e.g. to include upstream details). */
  message?: string
  params?: ErrorParams
  details?: unknown
  cause?: unknown
}

/**
 * Business error with a code from `ERRORS`; the status and default message come from the catalog.
 * `throw new AppException('ACCOUNT_EMAIL_TAKEN')`.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    const { status, message } = ERRORS[code]
    const body: ErrorBody = {
      statusCode: status,
      code,
      message: options.message ?? message,
      ...(options.params && { params: options.params }),
      ...(options.details !== undefined && { details: options.details }),
    }
    super(body, status, { cause: options.cause })
    this.code = code
  }

  override getResponse(): ErrorBody {
    return super.getResponse() as ErrorBody
  }
}
