import type { MaybeRefOrGetter } from 'vue'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

import { apiFetch } from '@/lib/api-client'

import type { IPaginated } from '../types/response.type'
import type { IClientUser, UserStatus } from '../types/user.type'

export interface IListUsersQuery {
  page?: number
  pageSize?: number
  /** Matches email or nickname. */
  keyword?: string
  status?: UserStatus
  /** `pending`: accounts scheduled for deletion; `none`: the others. */
  deletion?: 'pending' | 'none'
}

export interface IAdminUpdateUserBody {
  nickname?: string
  /** Disabling an account signs it out everywhere. */
  status?: UserStatus
}

/** Drops empty values so they are not sent as `?keyword=`. */
export function compactQuery<T extends object>(query: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>
}

// Transport layer for client app users (permissions: `user:read`, `user:update`, `user:delete`)
export function fetchAdminUsers(query: IListUsersQuery = {}) {
  return apiFetch<IPaginated<IClientUser>>('/users', { method: 'get', query: compactQuery(query) })
}

export function updateAdminUser(id: string, body: IAdminUpdateUserBody) {
  return apiFetch<IClientUser>(`/users/${id}`, { method: 'patch', body })
}

/**
 * Schedules deletion after the server's grace period and signs the user out; the user can still
 * restore the account until `deletionScheduledAt` (disable it as well to prevent that).
 */
export function scheduleAdminUserDeletion(id: string) {
  return apiFetch<IClientUser>(`/users/${id}/deletion`, { method: 'post' })
}

/** 409 `ACCOUNT_DELETION_NOT_CANCELLABLE` once the grace period has ended. */
export function cancelAdminUserDeletion(id: string) {
  return apiFetch<IClientUser>(`/users/${id}/deletion`, { method: 'delete' })
}

// Query/mutation hooks
export function useAdminUsersQuery(query: MaybeRefOrGetter<IListUsersQuery>) {
  const params = computed(() => compactQuery(toValue(query)))
  return useQuery({
    queryKey: ['adminUsers', params],
    queryFn: () => fetchAdminUsers(params.value),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['updateAdminUser'],
    mutationFn: ({ id, ...body }: IAdminUpdateUserBody & { id: string }) => updateAdminUser(id, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
  })
}

export function useAdminUserDeletionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['adminUserDeletion'],
    mutationFn: ({ id, pending }: { id: string, pending: boolean }) =>
      pending ? scheduleAdminUserDeletion(id) : cancelAdminUserDeletion(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
  })
}
