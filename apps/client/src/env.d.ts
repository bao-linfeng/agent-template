/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** apps/server API root including the prefix, e.g. `http://localhost:3100/api`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
