import type { MaybeRefOrGetter } from 'vue'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

import { apiFetch } from '@/lib/api-client'

import type { IPaginated } from '../types/response.type'
import type { IAdminUser, UserStatus } from '../types/user.type'

export interface IListUsersQuery {
  page?: number
  pageSize?: number
  /** Matches email or nickname. */
  keyword?: string
  status?: UserStatus
}

export interface IAdminUpdateUserBody {
  nickname?: string
  /** Disabling a user signs them out everywhere. */
  status?: UserStatus
}

/** Drops empty values so they are not sent as `?keyword=`. */
export function compactQuery<T extends object>(query: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>
}

// Transport layer (permissions: `user:read`, `user:update`)
export function fetchAdminUsers(query: IListUsersQuery = {}) {
  return apiFetch<IPaginated<IAdminUser>>('/admin/users', { method: 'get', query: compactQuery(query) })
}

export function fetchAdminUser(id: string) {
  return apiFetch<IAdminUser>(`/admin/users/${id}`, { method: 'get' })
}

export function updateAdminUser(id: string, body: IAdminUpdateUserBody) {
  return apiFetch<IAdminUser>(`/admin/users/${id}`, { method: 'patch', body })
}

/** Replaces the user's roles. */
export function setAdminUserRoles(id: string, roleIds: string[]) {
  return apiFetch<IAdminUser>(`/admin/users/${id}/roles`, { method: 'put', body: { roleIds } })
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

export interface IAdminUserChanges extends IAdminUpdateUserBody {
  id: string
  /** Sent only when the role selection changed. */
  roleIds?: string[]
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['updateAdminUser'],
    mutationFn: async ({ id, roleIds, ...body }: IAdminUserChanges) => {
      let user = Object.keys(body).length ? await updateAdminUser(id, body) : undefined
      if (roleIds)
        user = await setAdminUserRoles(id, roleIds)
      return user ?? await fetchAdminUser(id)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
  })
}
