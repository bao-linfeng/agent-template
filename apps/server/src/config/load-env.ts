import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Loads `.env.local` and `.env` from the server root into `process.env` without overriding variables
 * that are already set. Import this module first in every entrypoint (app, scripts, drizzle config)
 * so module-level code sees the same environment. Tests are hermetic and never read env files.
 */
export function loadEnvFiles(cwd = process.cwd()): void {
  if (process.env.NODE_ENV === 'test') {
    return
  }
  for (const file of ['.env.local', '.env']) {
    const path = resolve(cwd, file)
    if (existsSync(path)) {
      process.loadEnvFile(path)
    }
  }
}

loadEnvFiles()
