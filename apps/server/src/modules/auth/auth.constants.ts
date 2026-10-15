import type { Realm } from './realms.js';

/** Redis key marking a session as revoked so still-valid access tokens are rejected immediately. */
export const revokedSessionKey = (realm: Realm, sessionId: string) =>
  `auth:revoked-session:${realm}:${sessionId}`;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  /** Account population the token was issued for; a token is only accepted by routes of its realm. */
  realm: Realm;
}
