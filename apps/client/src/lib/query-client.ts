import { isUnauthorized } from '@repo/utils'
import { QueryClient } from '@tanstack/vue-query'

/**
 * Server-state cache (TanStack Vue Query). Unlike admin there is no global error toast: pages show
 * mutation errors inline. A 401 already went through the shared refresh, so it is not retried.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 3,
    },
  },
})
