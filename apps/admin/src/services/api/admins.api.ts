import type { MaybeRefOrGetter } from 'vue'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'

import { apiFetch } from '@/lib/api-client'

import type { IPaginated } from '../types/response.type'
import type { IAdminAccount } from '../types/user.type'
import type { IAdminUpdateUserBody, IListUsersQuery } from './admin-users.api'

import { compactQuery } from './admin-users.api'

export interface ICreateAdminBody {
  email: string
  /** Initial password, shared with the new administrator out of band. */
  password: string
  nickname: string
  roleIds?: string[]
}

// Transport layer for admin console accounts (permissions: `admin:read|create|update`)
export function fetchAdmins(query: IListUsersQuery = {}) {
  return apiFetch<IPaginated<IAdminAccount>>('/admin/admins', { method: 'get', query: compactQuery(query) })
}

export function fetchAdmin(id: string) {
  return apiFetch<IAdminAccount>(`/admin/admins/${id}`, { method: 'get' })
}

export function createAdmin(body: ICreateAdminBody) {
  return apiFetch<IAdminAccount>('/admin/admins', { method: 'post', body })
}

export function updateAdmin(id: string, body: IAdminUpdateUserBody) {
  return apiFetch<IAdminAccount>(`/admin/admins/${id}`, { method: 'patch', body })
}

/** Replaces the admin's roles. */
export function setAdminRoles(id: string, roleIds: string[]) {
  return apiFetch<IAdminAccount>(`/admin/admins/${id}/roles`, { method: 'put', body: { roleIds } })
}

// Query/mutation hooks
export function useAdminsQuery(query: MaybeRefOrGetter<IListUsersQuery>) {
  const params = computed(() => compactQuery(toValue(query)))
  return useQuery({
    queryKey: ['admins', params],
    queryFn: () => fetchAdmins(params.value),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export interface IAdminChanges extends IAdminUpdateUserBody {
  id: string
  /** Sent only when the role selection changed. */
  roleIds?: string[]
}

export function useUpdateAdminMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['updateAdmin'],
    mutationFn: async ({ id, roleIds, ...body }: IAdminChanges) => {
      let admin = Object.keys(body).length ? await updateAdmin(id, body) : undefined
      if (roleIds)
        admin = await setAdminRoles(id, roleIds)
      return admin ?? await fetchAdmin(id)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useCreateAdminMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['createAdmin'],
    mutationFn: createAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}
