import type { Realm } from './realms.js'

/**
 * Most wrong guesses a verification code may take before it is discarded (keeps 6 digits unguessable);
 * the runtime setting `auth.emailCodeMaxAttempts` can only lower it.
 */
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5

/** Redis key marking a session as revoked so still-valid access tokens are rejected immediately. */
export const revokedSessionKey = (realm: Realm, sessionId: string) =>
  `auth:revoked-session:${realm}:${sessionId}`

export interface AccessTokenPayload {
  sub: string
  email: string
  sid: string
  /** Account population the token was issued for; a token is only accepted by routes of its realm. */
  realm: Realm
}
