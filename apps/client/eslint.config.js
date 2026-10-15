import { defineConfig } from '@repo/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default defineConfig(
  {
    type: 'app',
    // Static third-party bundles (BuildY editor, Collecty) are served as-is
    ignores: ['public/**'],
  },
  ...pluginQuery.configs['flat/recommended'],
)
