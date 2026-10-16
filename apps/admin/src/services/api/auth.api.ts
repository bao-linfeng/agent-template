import { useMutation } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'

import type { IMfaChallenge, IUserProfile } from '../types/user.type'

export interface ILoginBody {
  email: string
  password: string
}

export interface IMfaLoginBody {
  challengeToken: string
  /** 6-digit authenticator code or a recovery code. */
  code: string
}

export interface IResetPasswordBody {
  token: string
  password: string
}

/** Page of this app that renders the token form; the server appends `?token=`. */
export function resetPasswordPageUrl(origin = window.location.origin) {
  return `${origin}/auth/reset-password`
}

export function isMfaChallenge(result: IUserProfile | IMfaChallenge): result is IMfaChallenge {
  return 'mfaRequired' in result && result.mfaRequired
}

// Transport layer for admin console accounts (`/v1/admin/auth`; there is no self-registration, admins are
// created under Admins). A successful login sets the HttpOnly admin session cookies; admins with two-factor
// authentication get a challenge instead and finish with `loginMfa`.
export function login(body: ILoginBody) {
  return apiFetch<IUserProfile | IMfaChallenge>('/auth/login', { method: 'post', body })
}

/** Second sign-in step: sets the session cookies. */
export function loginMfa(body: IMfaLoginBody) {
  return apiFetch<IUserProfile>('/auth/login/mfa', { method: 'post', body })
}

export function logout() {
  return apiFetch<void>('/auth/logout', { method: 'post' })
}

export function forgotPassword(email: string, resetUrl = resetPasswordPageUrl()) {
  return apiFetch<{ message: string }>('/auth/forgot-password', { method: 'post', body: { email, resetUrl } })
}

export function resetPassword(body: IResetPasswordBody) {
  return apiFetch<void>('/auth/reset-password', { method: 'post', body })
}

// Mutations (errors are toasted by the global MutationCache handler).
export function useForgotPasswordMutation() {
  return useMutation({ mutationKey: ['forgotPassword'], mutationFn: (email: string) => forgotPassword(email) })
}

export function useResetPasswordMutation() {
  return useMutation({ mutationKey: ['resetPassword'], mutationFn: resetPassword })
}
