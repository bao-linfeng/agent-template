import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app',
  },
  strict: true,
  verbose: true,
});
