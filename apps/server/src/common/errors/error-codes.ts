import { HttpStatus } from '@nestjs/common'

export interface ErrorDefinition {
  status: HttpStatus
  /** Default English message; clients translate by `code` and fall back to it. */
  message: string
}

/**
 * Every machine-readable error code the API answers with (`{ statusCode, code, message, params?, details? }`).
 * Codes are stable API: clients key their translations on them, so rename only with a new API version.
 * Add a code here, then throw `new AppException('<CODE>')`; the generic codes at the top are what the
 * exception filter assigns to plain Nest/Fastify errors by status.
 */
export const ERRORS = {
  // Generic, assigned by status to errors without a code.
  BAD_REQUEST: { status: HttpStatus.BAD_REQUEST, message: 'Bad request' },
  VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Request validation failed',
  },
  UNAUTHENTICATED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Authentication required',
  },
  FORBIDDEN: { status: HttpStatus.FORBIDDEN, message: 'Forbidden' },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Not found' },
  METHOD_NOT_ALLOWED: {
    status: HttpStatus.METHOD_NOT_ALLOWED,
    message: 'Method not allowed',
  },
  CONFLICT: { status: HttpStatus.CONFLICT, message: 'Conflict' },
  PAYLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Payload too large',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: 'Unsupported media type',
  },
  TOO_MANY_REQUESTS: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Too many requests, please try again later',
  },
  INTERNAL_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  },
  BAD_GATEWAY: { status: HttpStatus.BAD_GATEWAY, message: 'Bad gateway' },
  SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Service unavailable',
  },

  // Concurrency and duplicate submissions
  RESOURCE_LOCKED: {
    status: HttpStatus.CONFLICT,
    message:
      'Another operation on this resource is in progress, please try again shortly',
  },
  IDEMPOTENCY_KEY_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Idempotency-Key must be 1-255 printable ASCII characters',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'This operation requires an Idempotency-Key header',
  },
  IDEMPOTENCY_KEY_IN_PROGRESS: {
    status: HttpStatus.CONFLICT,
    message: 'A request with this Idempotency-Key is still being processed',
  },
  IDEMPOTENCY_KEY_MISMATCH: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'This Idempotency-Key was already used for a different request',
  },

  // Authentication and sessions
  AUTH_REQUIRED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Authentication required',
  },
  AUTH_TOKEN_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid or expired authentication token',
  },
  AUTH_SESSION_REVOKED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Session has been revoked',
  },
  AUTH_INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Email or password is incorrect',
  },
  AUTH_ACCOUNT_DISABLED: {
    status: HttpStatus.FORBIDDEN,
    message: 'This account has been disabled',
  },
  AUTH_REFRESH_TOKEN_MISSING: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Refresh token missing',
  },
  AUTH_REFRESH_TOKEN_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Refresh token is no longer valid',
  },
  AUTH_SESSION_EXPIRED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Session expired, please sign in again',
  },
  AUTH_ACCOUNT_PENDING_DELETION: {
    status: HttpStatus.FORBIDDEN,
    message:
      'This account is scheduled for deletion; restore it to sign in again',
  },
  AUTH_ACCOUNT_UNAVAILABLE: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Account is not available',
  },
  AUTH_RESET_URL_UNTRUSTED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'resetUrl must point to a trusted web app',
  },
  AUTH_RESET_TOKEN_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Reset link is invalid or has expired',
  },
  AUTH_TRANSPORT_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'X-Auth-Transport must be "cookie" or "bearer"',
  },
  AUTH_BEARER_UNSUPPORTED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Bearer tokens are not available for this realm',
  },
  AUTH_BEARER_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'refreshToken in the body requires X-Auth-Transport: bearer',
  },
  AUTH_CODE_RESEND_TOO_SOON: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message:
      'A code was sent recently, please wait before requesting another one',
  },
  AUTH_CODE_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Verification code is invalid or has expired',
  },
  AUTH_MFA_CHALLENGE_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Sign-in verification has expired, please sign in again',
  },
  AUTH_MFA_CODE_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Authentication code or recovery code is invalid',
  },
  AUTH_REGISTRATION_DISABLED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Registration is currently closed',
  },
  PERMISSION_DENIED: {
    status: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to perform this action',
  },

  // Accounts, uploads and files
  ACCOUNT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Account not found',
  },
  ACCOUNT_EMAIL_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Email is already registered',
  },
  ACCOUNT_PASSWORD_INCORRECT: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Current password is incorrect',
  },
  ACCOUNT_AVATAR_UNSUPPORTED: {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: 'Avatar must be a PNG, JPEG, GIF or WebP image',
  },
  ACCOUNT_DELETION_NOT_CANCELLABLE: {
    status: HttpStatus.CONFLICT,
    message: 'The grace period has ended and the account is being deleted',
  },
  ACCOUNT_EXPORT_IN_PROGRESS: {
    status: HttpStatus.CONFLICT,
    message: 'A data export is already being prepared',
  },
  ACCOUNT_EXPORT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Data export not found',
  },
  ACCOUNT_EXPORT_NOT_READY: {
    status: HttpStatus.CONFLICT,
    message: 'This data export is not ready for download',
  },
  ACCOUNT_EXPORT_EXPIRED: {
    status: HttpStatus.GONE,
    message: 'This data export has expired, please request a new one',
  },
  SESSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Session not found',
  },
  UPLOAD_NOT_MULTIPART: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Expected multipart/form-data',
  },
  UPLOAD_FILE_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Form field "file" is required',
  },
  UPLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'File is too large',
  },
  UPLOAD_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid multipart upload',
  },
  UPLOAD_INFECTED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'The file was rejected by the malware scan',
  },
  UPLOAD_SCAN_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Uploads cannot be scanned right now, please try again later',
  },
  FILE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'File not found' },

  // Admin console accounts and roles
  ADMIN_CANNOT_DISABLE_SELF: {
    status: HttpStatus.BAD_REQUEST,
    message: 'You cannot disable your own account',
  },
  ADMIN_CANNOT_REMOVE_OWN_SUPER_ADMIN: {
    status: HttpStatus.BAD_REQUEST,
    message: 'You cannot remove super_admin from yourself',
  },
  ADMIN_CANNOT_RESET_OWN_MFA: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'You cannot reset your own two-factor authentication; turn it off in your settings instead',
  },
  PERMISSIONS_EXCEED_OWN: {
    status: HttpStatus.FORBIDDEN,
    message: 'You can only grant or manage permissions that you hold yourself',
  },

  // Two-factor authentication (admin console)
  MFA_ALREADY_ENABLED: {
    status: HttpStatus.CONFLICT,
    message: 'Two-factor authentication is already enabled',
  },
  MFA_NOT_ENABLED: {
    status: HttpStatus.CONFLICT,
    message: 'Two-factor authentication is not enabled',
  },
  MFA_SETUP_EXPIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Two-factor setup has expired, please start again',
  },
  ROLE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Role not found' },
  ROLES_UNKNOWN: {
    status: HttpStatus.BAD_REQUEST,
    message: 'One or more roles do not exist',
  },
  ROLE_CODE_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Role code already exists',
  },
  ROLE_SUPER_ADMIN_IMMUTABLE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Permissions of super_admin cannot be changed',
  },
  ROLE_SYSTEM_UNDELETABLE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'System roles cannot be deleted',
  },

  // Runtime settings (admin console)
  SETTING_UNKNOWN: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Unknown setting',
  },
  SETTING_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid value for this setting',
  },

  // Notifications and announcements
  NOTIFICATION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Notification not found',
  },
  NOTIFICATION_CATEGORY_UNKNOWN: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Unknown notification category',
  },
  NOTIFICATION_CATEGORY_MANDATORY: {
    status: HttpStatus.BAD_REQUEST,
    message: 'This notification category cannot be turned off',
  },
  NOTIFICATION_PREFERENCE_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid notification preferences',
  },
  ANNOUNCEMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Announcement not found',
  },
  ANNOUNCEMENT_EXPIRY_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'The expiry time must be in the future',
  },
  ANNOUNCEMENT_SCHEDULE_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'The publish time must be in the future and before the expiry time',
  },

  // Audit log
  AUDIT_LOG_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Audit log entry not found',
  },

  // Embedding models and providers
  EMBEDDING_MODEL_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Embedding model not found',
  },
  EMBEDDING_MODEL_NAME_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'An embedding model with this name already exists',
  },
  EMBEDDING_MODEL_LOCKED: {
    status: HttpStatus.CONFLICT,
    message:
      'model and dimensions cannot change while knowledge bases use this model; create a new model instead',
  },
  EMBEDDING_MODEL_IN_USE: {
    status: HttpStatus.CONFLICT,
    message: 'This model is used by knowledge bases and cannot be deleted',
  },
  EMBEDDING_MODEL_IS_DEFAULT: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Set another default model first',
  },
  EMBEDDING_MODEL_DEFAULT_DISABLED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A disabled model cannot be the default',
  },
  EMBEDDING_MODEL_DISABLED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'The selected embedding model is disabled',
  },
  EMBEDDING_MODEL_NOT_CONFIGURED: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'No default embedding model is configured; ask an administrator to add one',
  },
  EMBEDDING_DIMENSIONS_OUT_OF_RANGE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'dimensions is out of range',
  },
  EMBEDDING_PROVIDER_UNREACHABLE: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Embedding provider unreachable',
  },
  EMBEDDING_PROVIDER_ERROR: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Embedding provider returned an error',
  },
  EMBEDDING_PROVIDER_INVALID_RESPONSE: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Embedding provider returned an invalid response',
  },
  EMBEDDING_DIMENSIONS_MISMATCH: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Embedding dimensions do not match the model configuration',
  },

  // Knowledge bases and documents
  KNOWLEDGE_BASE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Knowledge base not found',
  },
  KNOWLEDGE_BASE_CHUNK_OVERLAP_TOO_LARGE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'chunkOverlap must be at most half of chunkSize',
  },
  DOCUMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Document not found',
  },
  DOCUMENT_UNSUPPORTED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Unsupported document',
  },
} as const satisfies Record<string, ErrorDefinition>

export type ErrorCode = keyof typeof ERRORS

const STATUS_CODES = new Map<number, ErrorCode>([
  [HttpStatus.BAD_REQUEST, 'BAD_REQUEST'],
  [HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED'],
  [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
  [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
  [HttpStatus.METHOD_NOT_ALLOWED, 'METHOD_NOT_ALLOWED'],
  [HttpStatus.CONFLICT, 'CONFLICT'],
  [HttpStatus.PAYLOAD_TOO_LARGE, 'PAYLOAD_TOO_LARGE'],
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE'],
  [HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS'],
  [HttpStatus.BAD_GATEWAY, 'BAD_GATEWAY'],
  [HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE'],
])

/** Generic code for an error that carries only an HTTP status. */
export function codeForStatus(status: number): ErrorCode {
  return (
    STATUS_CODES.get(status) ??
    (status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR')
  )
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERRORS, value)
}
