import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'
import tailwind from 'tailwindcss'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwind(), autoprefixer()],
    },
    devSourcemap: false,
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve('./src')
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2
      },
      format: {
        comments: false,
        preserve_annotations: false
      },
      mangle: {
        toplevel: true
      }
    },
    assetsInlineLimit: 4096,
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: true
    }
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      overlay: false
    }
  },
  optimizeDeps: {
    include: ['@/composables/useFont']
  },
  test: {
    include: ['src/**/*.test.ts'],
    environmentOptions: {
      // initializeTheme injects a Google Fonts <link>; keep tests offline
      happyDOM: { settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/components/ui/**', 'src/scripts/**']
    }
  }
})
