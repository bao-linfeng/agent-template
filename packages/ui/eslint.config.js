import { defineConfig } from '@repo/eslint-config'

export default defineConfig({
  type: 'lib',
  // shadcn-vue generated sources: keep them diffable against upstream instead of reformatting
  ignores: ['src/components/**'],
})
