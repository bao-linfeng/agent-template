export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Redis key marking a session as revoked so still-valid access tokens are rejected immediately. */
export const revokedSessionKey = (sessionId: string) =>
  `auth:revoked-session:${sessionId}`;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
}
