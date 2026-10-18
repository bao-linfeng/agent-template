import { isUnauthorized } from '@repo/utils'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'

import { getErrorMessage } from '@/lib/api-client'

function handleError(error: Error) {
  if (isUnauthorized(error))
    return

  toast.error(getErrorMessage(error))
}

/**
 * Server-state cache (TanStack Vue Query), registered by `plugins/tanstack-vue-query`. Failed queries
 * and mutations are toasted, except 401s (the API client signs the admin out). The auth store drops
 * the cached data whenever the signed-in admin changes, so another admin never sees it.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
    },
  },
})
