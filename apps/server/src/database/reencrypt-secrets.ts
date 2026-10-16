import { sql } from 'drizzle-orm'
import type { SecretBox } from '../common/crypto/crypto.js'
import type { Database } from './database.js'

/**
 * Every column holding `SecretBox` ciphertext (database names). A new encrypted column must be
 * listed here, or rotating `ENCRYPTION_KEY` leaves its values on the old key.
 */
export const ENCRYPTED_COLUMNS = [
  { table: 'ai_embedding_models', id: 'id', column: 'api_key_encrypted' },
  {
    table: 'admin_totp_credentials',
    id: 'admin_user_id',
    column: 'secret_encrypted',
  },
] as const

const BATCH_SIZE = 500

type SecretRow = {
  id: string
  value: string
}

export interface ReencryptResult {
  /** `<table>.<column>` */
  column: string
  /** Values already encrypted with the current key. */
  current: number
  /** Values found on a previous key. */
  previous: number
  /** Values moved to the current key (0 in a dry run; rows changed meanwhile are skipped). */
  reencrypted: number
  /** Row ids whose value no configured key decrypts. */
  unreadable: string[]
}

/**
 * Re-encrypts stored secrets that are still on a previous key with the current key. Idempotent and
 * safe next to the running API: each row is updated only if its value is unchanged since it was read.
 */
export async function reencryptSecrets(
  db: Database,
  box: SecretBox,
  options: { dryRun?: boolean } = {},
): Promise<ReencryptResult[]> {
  const results: ReencryptResult[] = []
  for (const target of ENCRYPTED_COLUMNS) {
    const table = sql.identifier(target.table)
    const id = sql.identifier(target.id)
    const column = sql.identifier(target.column)
    const result: ReencryptResult = {
      column: `${target.table}.${target.column}`,
      current: 0,
      previous: 0,
      reencrypted: 0,
      unreadable: [],
    }
    let after: string | null = null
    for (;;) {
      const { rows }: { rows: SecretRow[] } = await db.execute<SecretRow>(sql`
        select ${id} as id, ${column} as value from ${table}
        where ${column} is not null ${after === null ? sql`` : sql`and ${id} > ${after}`}
        order by ${id}
        limit ${BATCH_SIZE}
      `)
      for (const row of rows) {
        let plaintext: string
        try {
          if (box.isCurrent(row.value)) {
            result.current++
            continue
          }
          plaintext = box.decrypt(row.value)
        } catch {
          result.unreadable.push(row.id)
          continue
        }
        result.previous++
        if (options.dryRun) {
          continue
        }
        const updated = await db.execute(sql`
          update ${table} set ${column} = ${box.encrypt(plaintext)}
          where ${id} = ${row.id} and ${column} = ${row.value}
        `)
        result.reencrypted += updated.rowCount ?? 0
      }
      if (rows.length < BATCH_SIZE) {
        break
      }
      after = rows.at(-1)!.id
    }
    results.push(result)
  }
  return results
}
