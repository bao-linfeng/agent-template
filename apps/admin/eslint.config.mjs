import { defineConfig } from '@repo/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default defineConfig(
  {
    type: 'app',
    ignores: [
      'shadcn-vue-admin-main/**',
      '**/build/**',
    ],
    settings: {
      'import/core-modules': ['vue-router/auto-routes'],
    },
    globals: {
      definePage: 'readonly',
    },
    imports: {
      overrides: {
        'perfectionist/sort-imports': ['error', {
          tsconfig: { rootDir: '.' },
        }],
      },
    },
  },
  ...pluginQuery.configs['flat/recommended'],
)
