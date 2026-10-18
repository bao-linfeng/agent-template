import z from 'zod'

export const EnvSchema = z.object({
  // Add your environment variables here, for example:
  // VITE_API_BASE_URL: z.string().url(),
  // API origin. Empty (the development default) means the page's own origin: the Vite dev server
  // proxies VITE_SERVER_API_PREFIX to API_PROXY_TARGET. Production images require an absolute URL.
  VITE_SERVER_API_URL: z.union([z.url(), z.literal('')]).default(''),
  VITE_SERVER_API_PREFIX: z.string(),
  VITE_SERVER_API_TIMEOUT: z.coerce.number().default(5000),
})

export type env = z.infer<typeof EnvSchema>
