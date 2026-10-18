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
  return apiFetch<IPaginated<IAdminAccount>>('/admins', { method: 'get', query: compactQuery(query) })
}

export function fetchAdmin(id: string) {
  return apiFetch<IAdminAccount>(`/admins/${id}`, { method: 'get' })
}

export function createAdmin(body: ICreateAdminBody) {
  return apiFetch<IAdminAccount>('/admins', { method: 'post', body })
}

export function updateAdmin(id: string, body: IAdminUpdateUserBody) {
  return apiFetch<IAdminAccount>(`/admins/${id}`, { method: 'patch', body })
}

/** Replaces the admin's roles. */
export function setAdminRoles(id: string, roleIds: string[]) {
  return apiFetch<IAdminAccount>(`/admins/${id}/roles`, { method: 'put', body: { roleIds } })
}

/** Removes another admin's two-factor authentication (lost device) and signs them out everywhere. */
export function resetAdminMfa(id: string) {
  return apiFetch<void>(`/admins/${id}/mfa`, { method: 'delete' })
}

/**
 * Applies the changes of the admin dialog: `PATCH` only for profile fields that are set (fields left
 * `undefined` are unchanged), `PUT /roles` only when `roleIds` is given; nothing changed just reloads.
 */
export async function saveAdminChanges({ id, roleIds, ...body }: IAdminChanges): Promise<IAdminAccount> {
  const profile = compactQuery(body)
  let admin = Object.keys(profile).length ? await updateAdmin(id, profile) : undefined
  if (roleIds)
    admin = await setAdminRoles(id, roleIds)
  return admin ?? await fetchAdmin(id)
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
    mutationFn: saveAdminChanges,
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

export function useResetAdminMfaMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['resetAdminMfa'],
    mutationFn: resetAdminMfa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admins'] }),
  })
}
