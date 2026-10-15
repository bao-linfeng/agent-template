import { inject } from 'vitest'

// Runs in each test worker before test files are imported, so ConfigModule validates the container env.
Object.assign(process.env, inject('testEnv'))
