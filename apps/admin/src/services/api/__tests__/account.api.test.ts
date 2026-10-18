import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cancelAdminUserDeletion, compactQuery, fetchAdminUsers, scheduleAdminUserDeletion, updateAdminUser } from '../admin-users.api'
import { createAdmin, fetchAdmin, fetchAdmins, resetAdminMfa, saveAdminChanges, setAdminRoles, updateAdmin } from '../admins.api'
import { forgotPassword, isMfaChallenge, login, loginMfa, logout, resetPassword, resetPasswordPageUrl } from '../auth.api'
import {
  createEmbeddingModel,
  deleteEmbeddingModel,
  setDefaultEmbeddingModel,
  testEmbeddingConfig,
  testEmbeddingModel,
  updateEmbeddingModel,
} from '../embedding-models.api'
import {
  changePassword,
  disableTotp,
  enableTotp,
  fetchMe,
  fetchMfaStatus,
  fetchSessions,
  regenerateRecoveryCodes,
  removeAvatar,
  revokeSession,
  startTotpSetup,
  updateMe,
  uploadAvatar,
} from '../me.api'
import { createRole, deleteRole, fetchPermissions, fetchRoles, updateRole } from '../roles.api'

const apiFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', () => ({ apiFetch }))
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }))

describe('auth transport', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue(undefined)
  })

  it('posts credentials to the admin auth routes', async () => {
    await login({ email: 'a@b.test', password: 'secret' })
    expect(apiFetch).toHaveBeenCalledWith('/auth/login', { method: 'post', body: { email: 'a@b.test', password: 'secret' } })

    await logout()
    expect(apiFetch).toHaveBeenLastCalledWith('/auth/logout', { method: 'post' })
  })

  it('completes two-factor sign-ins with a second request', async () => {
    await loginMfa({ challengeToken: 'c'.repeat(43), code: '123456' })
    expect(apiFetch).toHaveBeenCalledWith('/auth/login/mfa', {
      method: 'post',
      body: { challengeToken: 'c'.repeat(43), code: '123456' },
    })

    expect(isMfaChallenge({ mfaRequired: true, challengeToken: 'c', expiresIn: 300 })).toBe(true)
    expect(isMfaChallenge({
      id: 'a1',
      email: 'a@b.test',
      nickname: 'A',
      avatarUrl: null,
      status: 'active',
      lastLoginAt: null,
      deletionScheduledAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      roles: [],
      permissions: [],
      mfaEnabled: true,
    })).toBe(false)
  })

  it('asks for a reset link that opens this app', async () => {
    expect(resetPasswordPageUrl('https://admin.example.com')).toBe('https://admin.example.com/auth/reset-password')

    await forgotPassword('a@b.test', 'https://admin.example.com/auth/reset-password')
    expect(apiFetch).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'post',
      body: { email: 'a@b.test', resetUrl: 'https://admin.example.com/auth/reset-password' },
    })

    await resetPassword({ token: 't'.repeat(43), password: 'password1' })
    expect(apiFetch).toHaveBeenLastCalledWith('/auth/reset-password', {
      method: 'post',
      body: { token: 't'.repeat(43), password: 'password1' },
    })
  })
})

describe('current admin transport', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('reads and updates the profile', async () => {
    await fetchMe()
    expect(apiFetch).toHaveBeenCalledWith('/me', { method: 'get' })
    await updateMe({ nickname: 'Grace' })
    expect(apiFetch).toHaveBeenLastCalledWith('/me', { method: 'patch', body: { nickname: 'Grace' } })
  })

  it('uploads the avatar as multipart field "file"', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], 'me.png', { type: 'image/png' })
    await uploadAvatar(file, file.name)

    const [path, options] = apiFetch.mock.calls[0]!
    expect(path).toBe('/me/avatar')
    expect(options.method).toBe('put')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('file')).toBeInstanceOf(Blob)

    await removeAvatar()
    expect(apiFetch).toHaveBeenLastCalledWith('/me/avatar', { method: 'delete' })
  })

  it('changes the password and manages sessions', async () => {
    await changePassword({ currentPassword: 'old-pass', newPassword: 'new-pass-1' })
    expect(apiFetch).toHaveBeenCalledWith('/me/password', {
      method: 'post',
      body: { currentPassword: 'old-pass', newPassword: 'new-pass-1' },
    })
    await fetchSessions()
    expect(apiFetch).toHaveBeenLastCalledWith('/me/sessions', { method: 'get' })
    await revokeSession('s1')
    expect(apiFetch).toHaveBeenLastCalledWith('/me/sessions/s1', { method: 'delete' })
  })

  it('manages two-factor authentication', async () => {
    await fetchMfaStatus()
    expect(apiFetch).toHaveBeenCalledWith('/me/mfa', { method: 'get' })
    await startTotpSetup('pass-1')
    expect(apiFetch).toHaveBeenLastCalledWith('/me/mfa/totp/setup', { method: 'post', body: { password: 'pass-1' } })
    await enableTotp('123456')
    expect(apiFetch).toHaveBeenLastCalledWith('/me/mfa/totp/enable', { method: 'post', body: { code: '123456' } })
    await regenerateRecoveryCodes({ password: 'pass-1', code: '654321' })
    expect(apiFetch).toHaveBeenLastCalledWith('/me/mfa/recovery-codes', {
      method: 'post',
      body: { password: 'pass-1', code: '654321' },
    })
    await disableTotp({ password: 'pass-1', code: 'abcde-fghjk' })
    expect(apiFetch).toHaveBeenLastCalledWith('/me/mfa/totp/disable', {
      method: 'post',
      body: { password: 'pass-1', code: 'abcde-fghjk' },
    })
  })
})

describe('admin transport', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('lists client users without empty filters', async () => {
    expect(compactQuery({ page: 1, keyword: '', status: undefined, pageSize: 10 })).toEqual({ page: 1, pageSize: 10 })

    await fetchAdminUsers({ page: 2, pageSize: 20, keyword: 'ada', status: undefined })
    expect(apiFetch).toHaveBeenCalledWith('/users', { method: 'get', query: { page: 2, pageSize: 20, keyword: 'ada' } })
  })

  it('updates client users', async () => {
    await updateAdminUser('u1', { status: 'disabled' })
    expect(apiFetch).toHaveBeenCalledWith('/users/u1', { method: 'patch', body: { status: 'disabled' } })
  })

  it('schedules and cancels client user deletions', async () => {
    await scheduleAdminUserDeletion('u1')
    expect(apiFetch).toHaveBeenCalledWith('/users/u1/deletion', { method: 'post' })
    await cancelAdminUserDeletion('u1')
    expect(apiFetch).toHaveBeenLastCalledWith('/users/u1/deletion', { method: 'delete' })

    await fetchAdminUsers({ deletion: 'pending', keyword: '' })
    expect(apiFetch).toHaveBeenLastCalledWith('/users', { method: 'get', query: { deletion: 'pending' } })
  })

  it('manages admin accounts and their roles', async () => {
    await fetchAdmins({ page: 1, keyword: '' })
    expect(apiFetch).toHaveBeenCalledWith('/admins', { method: 'get', query: { page: 1 } })
    await fetchAdmin('a1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admins/a1', { method: 'get' })
    const body = { email: 'ops@b.test', password: 'password1', nickname: 'Ops', roleIds: ['r1'] }
    await createAdmin(body)
    expect(apiFetch).toHaveBeenLastCalledWith('/admins', { method: 'post', body })
    await updateAdmin('a1', { status: 'disabled' })
    expect(apiFetch).toHaveBeenLastCalledWith('/admins/a1', { method: 'patch', body: { status: 'disabled' } })
    await setAdminRoles('a1', ['r1', 'r2'])
    expect(apiFetch).toHaveBeenLastCalledWith('/admins/a1/roles', { method: 'put', body: { roleIds: ['r1', 'r2'] } })
    await resetAdminMfa('a1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admins/a1/mfa', { method: 'delete' })
  })

  it('saves only what the admin dialog changed', async () => {
    apiFetch.mockResolvedValue({ id: 'a1' })
    // Only the roles changed: no empty PATCH (the server rejected it before).
    await saveAdminChanges({ id: 'a1', nickname: undefined, status: undefined, roleIds: ['r1'] })
    expect(apiFetch.mock.calls).toEqual([['/admins/a1/roles', { method: 'put', body: { roleIds: ['r1'] } }]])

    apiFetch.mockClear()
    await saveAdminChanges({ id: 'a1', nickname: 'Ops', status: undefined })
    expect(apiFetch.mock.calls).toEqual([['/admins/a1', { method: 'patch', body: { nickname: 'Ops' } }]])

    apiFetch.mockClear()
    await expect(saveAdminChanges({ id: 'a1', nickname: undefined, status: undefined })).resolves.toEqual({ id: 'a1' })
    expect(apiFetch.mock.calls).toEqual([['/admins/a1', { method: 'get' }]])
  })

  it('manages roles', async () => {
    await fetchPermissions()
    expect(apiFetch).toHaveBeenCalledWith('/permissions', { method: 'get' })
    await fetchRoles()
    expect(apiFetch).toHaveBeenLastCalledWith('/roles', { method: 'get' })
    await createRole({ code: 'editor', name: 'Editor', permissions: ['user:read'] })
    expect(apiFetch).toHaveBeenLastCalledWith('/roles', {
      method: 'post',
      body: { code: 'editor', name: 'Editor', permissions: ['user:read'] },
    })
    await updateRole('r1', { permissions: [] })
    expect(apiFetch).toHaveBeenLastCalledWith('/roles/r1', { method: 'patch', body: { permissions: [] } })
    await deleteRole('r1')
    expect(apiFetch).toHaveBeenLastCalledWith('/roles/r1', { method: 'delete' })
  })

  it('manages embedding models', async () => {
    const config = { baseUrl: 'http://localhost:11434/v1', model: 'bge-m3', dimensions: 1024 }
    await createEmbeddingModel({ name: 'bge-m3', ...config })
    expect(apiFetch).toHaveBeenCalledWith('/ai/embedding-models', { method: 'post', body: { name: 'bge-m3', ...config } })
    await updateEmbeddingModel('m1', { apiKey: null })
    expect(apiFetch).toHaveBeenLastCalledWith('/ai/embedding-models/m1', { method: 'patch', body: { apiKey: null } })
    await setDefaultEmbeddingModel('m1')
    expect(apiFetch).toHaveBeenLastCalledWith('/ai/embedding-models/m1/default', { method: 'post' })
    await testEmbeddingModel('m1')
    expect(apiFetch).toHaveBeenLastCalledWith('/ai/embedding-models/m1/test', { method: 'post', timeout: 65_000 })
    await testEmbeddingConfig(config)
    expect(apiFetch).toHaveBeenLastCalledWith('/ai/embedding-models/test', { method: 'post', body: config, timeout: 65_000 })
    await deleteEmbeddingModel('m1')
    expect(apiFetch).toHaveBeenLastCalledWith('/ai/embedding-models/m1', { method: 'delete' })
  })
})
