import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'

import type { IMfaStatus, IRecoveryCodes, ISession, ITotpSetup, IUserProfile } from '../types/user.type'

export interface IUpdateProfileBody {
  nickname?: string
}

export interface IChangePasswordBody {
  currentPassword: string
  newPassword: string
}

/** Password plus a current authenticator code or an unused recovery code. */
export interface IConfirmMfaBody {
  password: string
  code: string
}

// Transport layer (the signed-in admin account)
export function fetchMe() {
  return apiFetch<IUserProfile>('/me', { method: 'get' })
}

export function updateMe(body: IUpdateProfileBody) {
  return apiFetch<IUserProfile>('/me', { method: 'patch', body })
}

/** PNG, JPEG, GIF or WebP; the server checks the file content and the size limit. */
/** Uploads may take longer than the default request timeout on slow connections. */
export const UPLOAD_TIMEOUT = 60_000

export function uploadAvatar(file: Blob, filename = 'avatar') {
  const body = new FormData()
  body.append('file', file, filename)
  return apiFetch<IUserProfile>('/me/avatar', { method: 'put', body, timeout: UPLOAD_TIMEOUT })
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

// Two-factor authentication of the signed-in admin
export function fetchMfaStatus() {
  return apiFetch<IMfaStatus>('/me/mfa', { method: 'get' })
}

/** Creates a pending secret (valid `expiresIn` seconds); nothing changes until `enableTotp`. */
export function startTotpSetup(password: string) {
  return apiFetch<ITotpSetup>('/me/mfa/totp/setup', { method: 'post', body: { password } })
}

/** Confirms the pending secret with the first code; signs out every other session. */
export function enableTotp(code: string) {
  return apiFetch<IRecoveryCodes>('/me/mfa/totp/enable', { method: 'post', body: { code } })
}

export function disableTotp(body: IConfirmMfaBody) {
  return apiFetch<void>('/me/mfa/totp/disable', { method: 'post', body })
}

export function regenerateRecoveryCodes(body: IConfirmMfaBody) {
  return apiFetch<IRecoveryCodes>('/me/mfa/recovery-codes', { method: 'post', body })
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

export function useMfaStatusQuery() {
  return useQuery({ queryKey: ['mfa'], queryFn: fetchMfaStatus, staleTime: 0 })
}

export function useStartTotpSetupMutation() {
  return useMutation({ mutationKey: ['startTotpSetup'], mutationFn: startTotpSetup })
}

/** Refreshes the status, the session list (others were signed out) and `mfaEnabled` in the auth store. */
function useMfaChangeMutation<V, R>(key: string, mutationFn: (variables: V) => Promise<R>, mfaEnabled: boolean) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  return useMutation({
    mutationKey: [key],
    mutationFn,
    onSuccess: () => {
      if (authStore.user)
        authStore.setUser({ ...authStore.user, mfaEnabled })
      queryClient.invalidateQueries({ queryKey: ['mfa'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export function useEnableTotpMutation() {
  return useMfaChangeMutation('enableTotp', enableTotp, true)
}

export function useDisableTotpMutation() {
  return useMfaChangeMutation('disableTotp', disableTotp, false)
}

export function useRegenerateRecoveryCodesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['regenerateRecoveryCodes'],
    mutationFn: regenerateRecoveryCodes,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mfa'] }),
  })
}
