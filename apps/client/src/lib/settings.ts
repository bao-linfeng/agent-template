import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { api } from './api'

/**
 * `GET /settings`: the runtime settings the server makes public (changed in the admin console under
 * System Settings, applied without a restart). Readable without signing in.
 */
export interface PublicSettings {
  /** Self-service sign-up; when false the server rejects `/auth/register*` with `AUTH_REGISTRATION_DISABLED`. */
  'auth.registrationEnabled': boolean
}

export const PUBLIC_SETTINGS_KEY = ['publicSettings']

export const settingsApi = {
  get: () => api<PublicSettings>('/settings'),
}

/** Unknown (still loading, request failed) counts as open: the server enforces the flag anyway. */
export function isRegistrationOpen(settings: Partial<PublicSettings> | undefined): boolean {
  return settings?.['auth.registrationEnabled'] !== false
}

/** Public settings through Vue Query, shared by every page that shows or hides features with them. */
export function usePublicSettings() {
  const { data, refetch } = useQuery({ queryKey: PUBLIC_SETTINGS_KEY, queryFn: settingsApi.get, staleTime: 60_000 })
  return {
    settings: data,
    refetch,
    registrationOpen: computed(() => isRegistrationOpen(data.value)),
  }
}
