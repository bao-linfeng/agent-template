import type { ErrorCode } from './error-codes.js'
import type { ErrorBody, ErrorParams } from './app.exception.js'

/** OpenAPI schema of `ErrorBody`, the body of every error response (properties come from the Swagger CLI plugin). */
export class ErrorResponseDto implements ErrorBody {
  /** HTTP status, repeated in the body. */
  statusCode!: number
  /** Machine-readable error code; clients translate by it. */
  code!: ErrorCode
  /** English message, shown when the client has no translation for `code`. */
  message!: string
  /** Values a translation may interpolate. */
  params?: ErrorParams
  /** Structured extra data, e.g. `[{ field, constraints }]` for `VALIDATION_FAILED`. */
  details?: unknown
}
