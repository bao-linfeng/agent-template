import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'

import type { ISession, IUserProfile } from '../types/user.type'

export interface IUpdateProfileBody {
  nickname?: string
}

export interface IChangePasswordBody {
  currentPassword: string
  newPassword: string
}

// Transport layer (the signed-in admin account)
export function fetchMe() {
  return apiFetch<IUserProfile>('/me', { method: 'get' })
}

export function updateMe(body: IUpdateProfileBody) {
  return apiFetch<IUserProfile>('/me', { method: 'patch', body })
}

/** PNG, JPEG, GIF or WebP; the server checks the file content and the size limit. */
export function uploadAvatar(file: Blob, filename = 'avatar') {
  const body = new FormData()
  body.append('file', file, filename)
  return apiFetch<IUserProfile>('/me/avatar', { method: 'put', body })
}

export function removeAvatar() {
  return apiFetch<IUserProfile>('/me/avatar', { method: 'delete' })
}

/** Signs out every other session on success. */
export function changePassword(body: IChangePasswordBody) {
  return apiFetch<void>('/me/password', { method: 'post', body })
}

export function fetchSessions() {
  return apiFetch<ISession[]>('/me/sessions', { method: 'get' })
}

export function revokeSession(id: string) {
  return apiFetch<void>(`/me/sessions/${id}`, { method: 'delete' })
}

// Query/mutation hooks. Profile mutations write the result back into the auth store.
function useProfileMutation<V>(key: string, mutationFn: (variables: V) => Promise<IUserProfile>) {
  const authStore = useAuthStore()
  return useMutation({
    mutationKey: [key],
    mutationFn,
    onSuccess: profile => authStore.setUser(profile),
  })
}

export function useUpdateMeMutation() {
  return useProfileMutation('updateMe', updateMe)
}

export function useUploadAvatarMutation() {
  return useProfileMutation('uploadAvatar', (file: File) => uploadAvatar(file, file.name))
}

export function useRemoveAvatarMutation() {
  return useProfileMutation('removeAvatar', () => removeAvatar())
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['changePassword'],
    mutationFn: changePassword,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useSessionsQuery() {
  return useQuery({ queryKey: ['sessions'], queryFn: fetchSessions, staleTime: 0 })
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['revokeSession'],
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
