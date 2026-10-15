import { beforeEach, describe, expect, it, vi } from 'vitest'

import { compactQuery, fetchAdminUsers, updateAdminUser } from '../admin-users.api'
import { createAdmin, fetchAdmin, fetchAdmins, setAdminRoles, updateAdmin } from '../admins.api'
import { forgotPassword, login, logout, resetPassword, resetPasswordPageUrl } from '../auth.api'
import {
  createEmbeddingModel,
  deleteEmbeddingModel,
  setDefaultEmbeddingModel,
  testEmbeddingConfig,
  testEmbeddingModel,
  updateEmbeddingModel,
} from '../embedding-models.api'
import { changePassword, fetchMe, fetchSessions, removeAvatar, revokeSession, updateMe, uploadAvatar } from '../me.api'
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
    expect(apiFetch).toHaveBeenCalledWith('/admin/auth/login', { method: 'post', body: { email: 'a@b.test', password: 'secret' } })

    await logout()
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/auth/logout', { method: 'post' })
  })

  it('asks for a reset link that opens this app', async () => {
    expect(resetPasswordPageUrl('https://admin.example.com')).toBe('https://admin.example.com/auth/reset-password')

    await forgotPassword('a@b.test', 'https://admin.example.com/auth/reset-password')
    expect(apiFetch).toHaveBeenCalledWith('/admin/auth/forgot-password', {
      method: 'post',
      body: { email: 'a@b.test', resetUrl: 'https://admin.example.com/auth/reset-password' },
    })

    await resetPassword({ token: 't'.repeat(43), password: 'password1' })
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/auth/reset-password', {
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
    expect(apiFetch).toHaveBeenCalledWith('/admin/me', { method: 'get' })
    await updateMe({ nickname: 'Grace' })
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/me', { method: 'patch', body: { nickname: 'Grace' } })
  })

  it('uploads the avatar as multipart field "file"', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], 'me.png', { type: 'image/png' })
    await uploadAvatar(file, file.name)

    const [path, options] = apiFetch.mock.calls[0]!
    expect(path).toBe('/admin/me/avatar')
    expect(options.method).toBe('put')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('file')).toBeInstanceOf(Blob)

    await removeAvatar()
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/me/avatar', { method: 'delete' })
  })

  it('changes the password and manages sessions', async () => {
    await changePassword({ currentPassword: 'old-pass', newPassword: 'new-pass-1' })
    expect(apiFetch).toHaveBeenCalledWith('/admin/me/password', {
      method: 'post',
      body: { currentPassword: 'old-pass', newPassword: 'new-pass-1' },
    })
    await fetchSessions()
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/me/sessions', { method: 'get' })
    await revokeSession('s1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/me/sessions/s1', { method: 'delete' })
  })
})

describe('admin transport', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('lists client users without empty filters', async () => {
    expect(compactQuery({ page: 1, keyword: '', status: undefined, pageSize: 10 })).toEqual({ page: 1, pageSize: 10 })

    await fetchAdminUsers({ page: 2, pageSize: 20, keyword: 'ada', status: undefined })
    expect(apiFetch).toHaveBeenCalledWith('/admin/users', { method: 'get', query: { page: 2, pageSize: 20, keyword: 'ada' } })
  })

  it('updates client users', async () => {
    await updateAdminUser('u1', { status: 'disabled' })
    expect(apiFetch).toHaveBeenCalledWith('/admin/users/u1', { method: 'patch', body: { status: 'disabled' } })
  })

  it('manages admin accounts and their roles', async () => {
    await fetchAdmins({ page: 1, keyword: '' })
    expect(apiFetch).toHaveBeenCalledWith('/admin/admins', { method: 'get', query: { page: 1 } })
    await fetchAdmin('a1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/admins/a1', { method: 'get' })
    const body = { email: 'ops@b.test', password: 'password1', nickname: 'Ops', roleIds: ['r1'] }
    await createAdmin(body)
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/admins', { method: 'post', body })
    await updateAdmin('a1', { status: 'disabled' })
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/admins/a1', { method: 'patch', body: { status: 'disabled' } })
    await setAdminRoles('a1', ['r1', 'r2'])
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/admins/a1/roles', { method: 'put', body: { roleIds: ['r1', 'r2'] } })
  })

  it('manages roles', async () => {
    await fetchPermissions()
    expect(apiFetch).toHaveBeenCalledWith('/admin/permissions', { method: 'get' })
    await fetchRoles()
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/roles', { method: 'get' })
    await createRole({ code: 'editor', name: 'Editor', permissions: ['user:read'] })
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/roles', {
      method: 'post',
      body: { code: 'editor', name: 'Editor', permissions: ['user:read'] },
    })
    await updateRole('r1', { permissions: [] })
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/roles/r1', { method: 'patch', body: { permissions: [] } })
    await deleteRole('r1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/roles/r1', { method: 'delete' })
  })

  it('manages embedding models', async () => {
    const config = { baseUrl: 'http://localhost:11434/v1', model: 'bge-m3', dimensions: 1024 }
    await createEmbeddingModel({ name: 'bge-m3', ...config })
    expect(apiFetch).toHaveBeenCalledWith('/admin/ai/embedding-models', { method: 'post', body: { name: 'bge-m3', ...config } })
    await updateEmbeddingModel('m1', { apiKey: null })
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/ai/embedding-models/m1', { method: 'patch', body: { apiKey: null } })
    await setDefaultEmbeddingModel('m1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/ai/embedding-models/m1/default', { method: 'post' })
    await testEmbeddingModel('m1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/ai/embedding-models/m1/test', { method: 'post', timeout: 65_000 })
    await testEmbeddingConfig(config)
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/ai/embedding-models/test', { method: 'post', body: config, timeout: 65_000 })
    await deleteEmbeddingModel('m1')
    expect(apiFetch).toHaveBeenLastCalledWith('/admin/ai/embedding-models/m1', { method: 'delete' })
  })
})
