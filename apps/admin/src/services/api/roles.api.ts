import type { MaybeRefOrGetter } from 'vue'

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'

export interface IRole {
  id: string
  /** Stable lower snake case identifier. */
  code: string
  name: string
  description: string | null
  /** System roles cannot be deleted; `super_admin` always keeps `all:manage`. */
  isSystem: boolean
  permissions: string[]
  /** Number of admin accounts holding the role. */
  userCount: number
  createdAt: string
}

export interface IPermission {
  code: string
  description: string
}

export interface ICreateRoleBody {
  code: string
  name: string
  description?: string
  permissions: string[]
}

export type IUpdateRoleBody = Partial<Omit<ICreateRoleBody, 'code'>>

// Transport layer (permissions: `role:read|create|update|delete`)
export function fetchPermissions() {
  return apiFetch<IPermission[]>('/admin/permissions', { method: 'get' })
}

export function fetchRoles() {
  return apiFetch<IRole[]>('/admin/roles', { method: 'get' })
}

export function createRole(body: ICreateRoleBody) {
  return apiFetch<IRole>('/admin/roles', { method: 'post', body })
}

export function updateRole(id: string, body: IUpdateRoleBody) {
  return apiFetch<IRole>(`/admin/roles/${id}`, { method: 'patch', body })
}

export function deleteRole(id: string) {
  return apiFetch<void>(`/admin/roles/${id}`, { method: 'delete' })
}

// Query/mutation hooks
export function usePermissionsQuery() {
  return useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions, staleTime: Infinity })
}

export function useRolesQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 30_000, enabled })
}

function useRoleMutation<V, R>(key: string, mutationFn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [key],
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['admins'] })
    },
  })
}

export type SaveRoleVariables
  = | { id?: undefined, body: ICreateRoleBody }
    | { id: string, body: IUpdateRoleBody }

export function useSaveRoleMutation() {
  return useRoleMutation('saveRole', (variables: SaveRoleVariables) =>
    variables.id === undefined ? createRole(variables.body) : updateRole(variables.id, variables.body))
}

export function useDeleteRoleMutation() {
  return useRoleMutation('deleteRole', deleteRole)
}
