import type { App } from 'vue'

import { VueQueryPlugin } from '@tanstack/vue-query'

import { queryClient } from '@/lib/query-client'

export function setupTanstackVueQuery(app: App) {
  app.use(VueQueryPlugin, {
    queryClient,
  })
}
