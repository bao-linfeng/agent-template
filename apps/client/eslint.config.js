import { defineConfig } from '@repo/eslint-config'

export default defineConfig({
  type: 'app',
  // Static third-party bundles (BuildY editor, Collecty) are served as-is
  ignores: ['public/**'],
})
