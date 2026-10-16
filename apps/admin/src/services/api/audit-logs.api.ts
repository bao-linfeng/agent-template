import type { MaybeRefOrGetter } from 'vue'

import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import dayjs from 'dayjs'
import { computed, toValue } from 'vue'

import { apiFetch } from '@/lib/api-client'

import type { IPaginated } from '../types/response.type'

import { compactQuery } from './admin-users.api'

export type AuditRealm = 'user' | 'admin'
export type AuditOutcome = 'success' | 'failure'

/** One audited API request (`/v1/admin/audit-logs`). Dates are ISO strings; secrets in `body`/`query` are `[redacted]`. */
export interface IAuditLog {
  id: string
  /** `admin` (this console) or `user` (client app); null for realm-less public routes. */
  realm: AuditRealm | null
  /** Null for anonymous requests such as failed sign-ins. */
  actorId: string | null
  actorEmail: string | null
  /** `<Controller>.<handler>`, e.g. `RolesController.update`. */
  action: string
  method: string
  /** Route pattern, e.g. `/api/v1/admin/roles/:id`. */
  route: string
  path: string
  resourceId: string | null
  params: Record<string, unknown> | null
  query: Record<string, unknown> | null
  body: unknown
  statusCode: number
  /** Error `code` of the response (`apiErrors.<code>`), null on success. */
  errorCode: string | null
  durationMs: number
  ip: string | null
  userAgent: string | null
  requestId: string | null
  createdAt: string
}

export interface IListAuditLogsQuery {
  page?: number
  pageSize?: number
  /** Matches the actor email, action and path. */
  keyword?: string
  realm?: AuditRealm
  actorId?: string
  action?: string
  method?: string
  resourceId?: string
  outcome?: AuditOutcome
  /** Inclusive lower bound (ISO 8601). */
  from?: string
  /** Exclusive upper bound (ISO 8601). */
  to?: string
}

/**
 * Turns a local `YYYY-MM-DD` day range (both days included, either side optional) into the API's
 * `from` (inclusive) / `to` (exclusive) instants.
 */
export function dayRangeQuery(fromDay?: string, toDay?: string): Pick<IListAuditLogsQuery, 'from' | 'to'> {
  return {
    from: fromDay ? dayjs(fromDay).startOf('day').toISOString() : undefined,
    to: toDay ? dayjs(toDay).startOf('day').add(1, 'day').toISOString() : undefined,
  }
}

// Transport layer (permission: `audit-log:read`)
export function fetchAuditLogs(query: IListAuditLogsQuery = {}) {
  return apiFetch<IPaginated<IAuditLog>>('/audit-logs', { method: 'get', query: compactQuery(query) })
}

export function fetchAuditLog(id: string) {
  return apiFetch<IAuditLog>(`/audit-logs/${id}`, { method: 'get' })
}

// Query hooks
export function useAuditLogsQuery(query: MaybeRefOrGetter<IListAuditLogsQuery>) {
  const params = computed(() => compactQuery(toValue(query)))
  return useQuery({
    queryKey: ['auditLogs', params],
    queryFn: () => fetchAuditLogs(params.value),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}
