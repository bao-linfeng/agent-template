import { Injectable } from '@nestjs/common'
import { lt, or } from 'drizzle-orm'
import { deleteInBatches } from '../../database/batch-delete.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { REALMS, REALM_TABLES } from '../auth/realms.js'

/**
 * Deletes login sessions that expired or were revoked before `before`, and password reset tokens that
 * expired or were used before it, in both realms. Such rows can never authenticate again: a refresh
 * token of a deleted session fails like an expired one, and access tokens outlive their session by at
 * most `ACCESS_TOKEN_TTL_SECONDS`.
 */
@Injectable()
export class AuthRecordsCleanup {
  constructor(@InjectDb() private readonly db: Database) {}

  async run(before: Date): Promise<{ sessions: number; resetTokens: number }> {
    const deleted = { sessions: 0, resetTokens: 0 }
    for (const realm of REALMS) {
      const { sessions, resetTokens } = REALM_TABLES[realm]
      deleted.sessions += await deleteInBatches(
        this.db,
        sessions,
        sessions.id,
        or(lt(sessions.expiresAt, before), lt(sessions.revokedAt, before)),
      )
      deleted.resetTokens += await deleteInBatches(
        this.db,
        resetTokens,
        resetTokens.id,
        or(lt(resetTokens.expiresAt, before), lt(resetTokens.usedAt, before)),
      )
    }
    return deleted
  }
}
