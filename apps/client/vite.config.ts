import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  // Same-origin API path used when VITE_API_BASE_URL is unset or relative (see src/lib/api.ts).
  const apiPath = env.VITE_API_BASE_URL?.startsWith('/') ? env.VITE_API_BASE_URL.replace(/\/+$/, '') : '/api'

  return {
    css: {
      devSourcemap: false,
    },
    plugins: [vue(), tailwindcss()],
    // vue-i18n esm-bundler flags: Composition API only, so the legacy API is tree-shaken
    define: {
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info'],
          passes: 2,
        },
        format: {
          comments: false,
          preserve_annotations: false,
        },
        mangle: {
          toplevel: true,
        },
      },
      assetsInlineLimit: 4096,
      sourcemap: false,
      cssCodeSplit: true,
      modulePreload: {
        polyfill: true,
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      hmr: {
        overlay: false,
      },
      proxy: {
        [apiPath]: {
          target: env.API_PROXY_TARGET || 'http://localhost:3100',
          changeOrigin: true,
        },
      },
    },
    test: {
      include: ['src/**/*.test.ts'],
      // Pins the UI language to English so assertions do not depend on the machine's locale
      setupFiles: ['src/test-setup.ts'],
      environmentOptions: {
      // initializeTheme injects a Google Fonts <link>; keep tests offline
        happyDOM: { settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } },
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.d.ts', 'src/**/__tests__/**'],
      },
    },
  }
})
