// Moves stored secrets from ENCRYPTION_KEYS_PREVIOUS to ENCRYPTION_KEY. Run after rotating the key:
// pnpm db:reencrypt [--dry-run] (dev) or node dist/scripts/reencrypt-secrets.js [--dry-run] (prod).
// Exits with 1 when a value cannot be decrypted, and in a dry run also while values remain on a previous key.
import '../config/load-env.js'
import { SecretBox } from '../common/crypto/crypto.js'
import { validateEnv } from '../config/env.js'
import { createDatabase, createPool } from '../database/database.js'
import { reencryptSecrets } from '../database/reencrypt-secrets.js'

const dryRun = process.argv.includes('--dry-run')
const env = validateEnv(process.env)
const pool = createPool(env.DATABASE_URL, { max: 1 })
try {
  const results = await reencryptSecrets(
    createDatabase(pool),
    new SecretBox(env.ENCRYPTION_KEY, env.ENCRYPTION_KEYS_PREVIOUS),
    { dryRun },
  )
  let failed = false
  for (const result of results) {
    console.log(
      `${result.column}: ${result.current} current, ${result.previous} on a previous key` +
        (dryRun ? '' : `, ${result.reencrypted} re-encrypted`) +
        `, ${result.unreadable.length} unreadable`,
    )
    if (result.unreadable.length > 0) {
      console.log(`  unreadable ids: ${result.unreadable.join(', ')}`)
      failed = true
    }
    if (dryRun && result.previous > 0) {
      failed = true
    }
  }
  if (dryRun) {
    console.log(
      failed
        ? 'Dry run: nothing changed; values remain on previous or unknown keys'
        : 'Dry run: every value uses ENCRYPTION_KEY; ENCRYPTION_KEYS_PREVIOUS can be removed',
    )
  }
  process.exitCode = failed ? 1 : 0
} finally {
  await pool.end()
}
