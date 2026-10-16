import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'

/** The JSON Schema subset the server emits for setting values (`z.toJSONSchema`). */
export interface ISettingSchema {
  type?: 'boolean' | 'integer' | 'number' | 'string' | 'array' | 'object'
  enum?: unknown[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  [keyword: string]: unknown
}

/**
 * One runtime setting (`/v1/admin/settings`). Changes apply on every API instance without a restart;
 * infrastructure, secrets and security switches such as the audit log stay in env and are not listed.
 */
export interface ISettingView {
  /** Stable dotted key, e.g. `auth.registrationEnabled`. */
  key: string
  /** Effective value: the stored override, or `defaultValue`. */
  value: unknown
  /** Value while nothing is stored (usually the env variable of the same meaning). */
  defaultValue: unknown
  overridden: boolean
  /** Readable without signing in through `GET /v1/client/settings`. */
  public: boolean
  /** Server-side description (Chinese), used when the console has no translation for the key. */
  description: string
  schema: ISettingSchema
  /** Last change of the override; null while the default applies. */
  updatedAt: string | null
  /** Admin who made it (null once that admin is deleted). */
  updatedBy: string | null
}

/** New values by key; `null` resets a setting to its default. Applied atomically. */
export type SettingChanges = Record<string, unknown>

const SETTINGS_KEY = ['settings']

// Transport layer (permissions: `setting:read|manage`)
export function fetchSettings() {
  return apiFetch<ISettingView[]>('/settings', { method: 'get' })
}

/** 400 `SETTING_UNKNOWN` / `SETTING_INVALID` (with `params.key`) rejects the whole change. */
export function updateSettings(values: SettingChanges) {
  return apiFetch<ISettingView[]>('/settings', { method: 'patch', body: { values } })
}

// Query/mutation hooks
export function useSettingsQuery() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchSettings, staleTime: 0 })
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['updateSettings'],
    mutationFn: updateSettings,
    // The response is the full, updated list.
    onSuccess: views => queryClient.setQueryData(SETTINGS_KEY, views),
  })
}
