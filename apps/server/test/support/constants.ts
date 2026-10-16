/** Super admin created by the e2e global setup. */
export const E2E_ADMIN = {
  email: 'admin@e2e.test',
  password: 'AdminPass123!',
  nickname: 'E2E Admin',
}

/**
 * `ENCRYPTION_KEYS_PREVIOUS` of the e2e app (`ENCRYPTION_KEY` keeps its development default), so tests
 * can store values encrypted with a rotated-out key.
 */
export const E2E_PREVIOUS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
  'base64',
)
