import { defineConfig } from 'vitest/config';

// E2E tests boot the real Fastify app against throwaway Postgres/Redis/RustFS containers (Docker required).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/env.ts'],
    // Files share the containers; run them one by one so rate limits and caches stay predictable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 240_000,
  },
});
