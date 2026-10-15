import { useMutation } from '@tanstack/vue-query'

import { apiFetch } from '@/lib/api-client'

import type { IUserProfile } from '../types/user.type'

export interface ILoginBody {
  email: string
  password: string
}

export interface IResetPasswordBody {
  token: string
  password: string
}

/** Page of this app that renders the token form; the server appends `?token=`. */
export function resetPasswordPageUrl(origin = window.location.origin) {
  return `${origin}/auth/reset-password`
}

// Transport layer for admin console accounts (`/admin/auth`; there is no self-registration, admins are
// created under Admins). A successful login sets the HttpOnly admin session cookies.
export function login(body: ILoginBody) {
  return apiFetch<IUserProfile>('/admin/auth/login', { method: 'post', body })
}

export function logout() {
  return apiFetch<void>('/admin/auth/logout', { method: 'post' })
}

export function forgotPassword(email: string, resetUrl = resetPasswordPageUrl()) {
  return apiFetch<{ message: string }>('/admin/auth/forgot-password', { method: 'post', body: { email, resetUrl } })
}

export function resetPassword(body: IResetPasswordBody) {
  return apiFetch<void>('/admin/auth/reset-password', { method: 'post', body })
}

// Mutations (errors are toasted by the global MutationCache handler).
export function useForgotPasswordMutation() {
  return useMutation({ mutationKey: ['forgotPassword'], mutationFn: (email: string) => forgotPassword(email) })
}

export function useResetPasswordMutation() {
  return useMutation({ mutationKey: ['resetPassword'], mutationFn: resetPassword })
}
