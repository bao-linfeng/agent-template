import { api } from './api'

/** Uploads and downloads may take longer than the default request timeout on slow connections. */
const TRANSFER_TIMEOUT = 120_000

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
  /** Set while a deletion is pending; such accounts are signed out until restored. */
  deletionScheduledAt: string | null
  createdAt: string
}

export type DataExportStatus = 'pending' | 'processing' | 'ready' | 'failed'

/** `POST /users/me/exports`: a personal data export (one JSON file), built in the background. */
export interface DataExport {
  id: string
  status: DataExportStatus
  sizeBytes: number | null
  createdAt: string
  completedAt: string | null
  /** Downloadable until then (ready exports only). */
  expiresAt: string | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  nickname: string
  /** 6-digit code emailed by `sendRegisterCode`. */
  code: string
}

/** `POST /auth/register/send-code`: seconds until the code expires and until another one may be requested. */
export interface SentCode {
  expiresIn: number
  resendAfter: number
}

/** Page of this app that renders the reset form; the server appends `?token=`. */
export function resetPasswordPageUrl(origin = window.location.origin) {
  return `${origin}/reset-password`
}

// Session cookies are set by the server on login/register/refresh.
export const accountApi = {
  /** 403 `AUTH_ACCOUNT_PENDING_DELETION` (with `params.scheduledAt`) while a deletion is pending. */
  login: (body: Credentials) => api<UserProfile>('/auth/login', { method: 'POST', body }),
  /** Cancels a pending deletion and signs in; 409 once the grace period has ended. */
  restoreAccount: (body: Credentials) => api<UserProfile>('/auth/restore', { method: 'POST', body }),
  /** 409 when the email is already registered, 429 while the resend cooldown runs. */
  sendRegisterCode: (email: string) =>
    api<SentCode>('/auth/register/send-code', { method: 'POST', body: { email } }),
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
    return api<UserProfile>('/users/me/avatar', { method: 'PUT', body, timeout: TRANSFER_TIMEOUT })
  },
  removeAvatar: () => api<UserProfile>('/users/me/avatar', { method: 'DELETE' }),
  /** Signs out every other session. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/users/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
  /** Signs out every session; the account is purged at `deletionScheduledAt` unless restored before. */
  requestDeletion: (password: string) =>
    api<{ deletionScheduledAt: string }>('/users/me/deletion', { method: 'POST', body: { password } }),

  /** 409 `ACCOUNT_EXPORT_IN_PROGRESS` while another export is being built. */
  requestExport: () => api<DataExport>('/users/me/exports', { method: 'POST', idempotencyKey: true }),
  listExports: (pageSize = 5) => api<Page<DataExport>>('/users/me/exports', { query: { pageSize } }),
  /** The export file as a JSON blob (not parsed, not held as a string). */
  downloadExport: async (id: string) => {
    const file = await api<Blob>(`/users/me/exports/${id}/download`, { responseType: 'blob', timeout: TRANSFER_TIMEOUT })
    return new Blob([file], { type: 'application/json' })
  },
}

/** File name of a downloaded export, e.g. `account-export-2026-10-16.json`. */
export function exportFileName(exported: Pick<DataExport, 'createdAt'>) {
  return `account-export-${exported.createdAt.slice(0, 10)}.json`
}
