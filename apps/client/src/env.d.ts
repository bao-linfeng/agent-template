/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * apps/server API root including the prefix, e.g. `https://api.example.com/api`. Unset: `/api` on
   * the page's own origin, proxied by the dev server to `API_PROXY_TARGET` (default `http://localhost:3100`).
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
