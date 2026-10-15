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

// Transport layer for client app users (permissions: `user:read`, `user:update`)
export function fetchAdminUsers(query: IListUsersQuery = {}) {
  return apiFetch<IPaginated<IClientUser>>('/admin/users', { method: 'get', query: compactQuery(query) })
}

export function updateAdminUser(id: string, body: IAdminUpdateUserBody) {
  return apiFetch<IClientUser>(`/admin/users/${id}`, { method: 'patch', body })
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
