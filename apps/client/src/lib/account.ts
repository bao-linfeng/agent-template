import { api } from './api'

/**
 * `GET /users/me`: the signed-in client user. Dates are ISO strings. Client users have no roles or
 * permissions (those belong to the separate admin console accounts); they can only act on their own data.
 */
export interface UserProfile {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  status: 'active' | 'disabled'
  lastLoginAt: string | null
  createdAt: string
}

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  nickname: string
}

/** Page of this app that renders the reset form; the server appends `?token=`. */
export function resetPasswordPageUrl(origin = window.location.origin) {
  return `${origin}/reset-password`
}

// Session cookies are set by the server on login/register/refresh.
export const accountApi = {
  login: (body: Credentials) => api<UserProfile>('/auth/login', { method: 'POST', body }),
  register: (body: Registration) => api<UserProfile>('/auth/register', { method: 'POST', body }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  /** Always succeeds (202) whether or not the email is registered. */
  forgotPassword: (email: string, resetUrl = resetPasswordPageUrl()) =>
    api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email, resetUrl } }),
  resetPassword: (token: string, password: string) =>
    api<void>('/auth/reset-password', { method: 'POST', body: { token, password } }),

  me: () => api<UserProfile>('/users/me'),
  updateProfile: (body: { nickname?: string }) => api<UserProfile>('/users/me', { method: 'PATCH', body }),
  /** PNG, JPEG, GIF or WebP; the server checks the content and the size limit. */
  uploadAvatar: (file: Blob, filename = 'avatar') => {
    const body = new FormData()
    body.append('file', file, filename)
    return api<UserProfile>('/users/me/avatar', { method: 'PUT', body })
  },
  removeAvatar: () => api<UserProfile>('/users/me/avatar', { method: 'DELETE' }),
  /** Signs out every other session. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/users/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
}
