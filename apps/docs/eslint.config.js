import { defineConfig } from '@repo/eslint-config'

export default defineConfig({
  type: 'app',
  ignores: ['.vitepress/cache/**'],
})
