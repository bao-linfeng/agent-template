import type { App } from 'vue'

import { isUnauthorized } from '@repo/utils'
import { MutationCache, QueryCache, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import { getErrorMessage } from '@/lib/api-client'

function handleError(error: Error) {
  if (isUnauthorized(error))
    return

  toast.error(getErrorMessage(error))
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
    },
  },
})

export function setupTanstackVueQuery(app: App) {
  app.use(VueQueryPlugin, {
    queryClient,
  })
}
