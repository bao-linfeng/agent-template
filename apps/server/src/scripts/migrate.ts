// Applies pending SQL migrations from ./drizzle. Run: pnpm db:migrate (dev) or node dist/scripts/migrate.js (prod).
import '../config/load-env.js'
import { validateEnv } from '../config/env.js'
import { runMigrations } from '../database/database.js'

const env = validateEnv(process.env)
await runMigrations(env.DATABASE_URL)
console.log('Migrations applied')
