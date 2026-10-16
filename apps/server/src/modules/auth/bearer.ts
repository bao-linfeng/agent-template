import { AppException } from '../../common/errors/app.exception.js'
import type { HttpRequest } from '../../common/http/request.js'
import { BEARER_REALMS, type Realm } from './realms.js'

/** Request header of the credential endpoints: `bearer` returns tokens in the body instead of setting cookies. */
export const AUTH_TRANSPORT_HEADER = 'x-auth-transport'

/** Token pair handed to bearer clients; they store it themselves and send `Authorization: Bearer <accessToken>`. */
export interface BearerTokens {
  tokenType: 'Bearer'
  accessToken: string
  /** Seconds until the access token expires. */
  expiresIn: number
  /** Exchange it at `POST <auth>/refresh`; it rotates on every use. */
  refreshToken: string
  /** Seconds until the refresh token (the session) expires. */
  refreshExpiresIn: number
}

/** The access token of an `Authorization: Bearer <token>` header, if any. */
export function readBearerToken(request: HttpRequest): string | undefined {
  return /^Bearer +(\S+) *$/i.exec(request.headers.authorization ?? '')?.[1]
}

/**
 * Whether a credential request asked for body tokens. `cookie` or no header keeps the browser flow;
 * any other value, or `bearer` on a realm outside `BEARER_REALMS`, is a 400 so a misconfigured client
 * fails loudly instead of silently falling back to cookies.
 */
export function usesBearerTransport(
  request: HttpRequest,
  realm: Realm,
): boolean {
  const transport = request.headers[AUTH_TRANSPORT_HEADER]
  if (transport === undefined || transport === 'cookie') {
    return false
  }
  if (transport !== 'bearer') {
    throw new AppException('AUTH_TRANSPORT_INVALID')
  }
  if (!BEARER_REALMS.has(realm)) {
    throw new AppException('AUTH_BEARER_UNSUPPORTED')
  }
  return true
}
