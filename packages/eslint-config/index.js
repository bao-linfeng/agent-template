import antfu from '@antfu/eslint-config'

/**
 * Shared Antfu-based ESLint config for the Vue workspaces.
 * Options are merged over the defaults below; extra flat configs can be passed after them.
 *
 * @param {import('@antfu/eslint-config').OptionsConfig & import('@antfu/eslint-config').TypedFlatConfigItem} [options]
 * @param {...import('@antfu/eslint-config').TypedFlatConfigItem} userConfigs
 */
export function defineConfig({ ignores = [], ...options } = {}, ...userConfigs) {
  return antfu({
    typescript: true,
    vue: {
      overrides: {
        'vue/block-lang': ['warn', {
          script: { lang: ['ts', 'tsx'] },
        }],
      },
    },
    // The root catalog only pins versions shared across workspaces; don't force every dependency into it.
    // Enabling this also makes the rule rewrite the root pnpm-workspace.yaml even without --fix.
    pnpm: { catalogs: false },
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
    },
    ...options,
    ignores: ['**/dist/**', '**/coverage/**', ...ignores],
  }, ...userConfigs)
}

export default defineConfig
