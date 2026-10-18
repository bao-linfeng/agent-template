import { describe, expect, it } from 'vitest'

import { coversPermissions, filterByPermission, hasPermission } from '@/lib/permissions'

describe('hasPermission', () => {
  it('matches exact codes', () => {
    expect(hasPermission(['user:read'], 'user:read')).toBe(true)
    expect(hasPermission(['user:read'], 'user:update')).toBe(false)
    expect(hasPermission([], 'user:read')).toBe(false)
  })

  it('treats manage and the all subject like the server CASL rules', () => {
    expect(hasPermission(['all:manage'], 'role:delete')).toBe(true)
    expect(hasPermission(['embedding-model:manage'], 'embedding-model:read')).toBe(true)
    expect(hasPermission(['embedding-model:manage'], 'role:read')).toBe(false)
    expect(hasPermission(['all:read'], 'knowledge-base:read')).toBe(true)
    expect(hasPermission(['all:read'], 'knowledge-base:create')).toBe(false)
  })
})

describe('coversPermissions', () => {
  it('requires every permission to be granted', () => {
    expect(coversPermissions(['admin:update', 'user:read'], [])).toBe(true)
    expect(coversPermissions(['admin:update', 'user:read'], ['user:read', 'admin:update'])).toBe(true)
    expect(coversPermissions(['admin:update', 'user:read'], ['user:read', 'user:update'])).toBe(false)
    expect(coversPermissions(['knowledge-base:manage'], ['knowledge-base:read'])).toBe(true)
  })

  it('only lets super admins grant all:manage', () => {
    expect(coversPermissions(['admin:update', 'role:update'], ['all:manage'])).toBe(false)
    expect(coversPermissions(['all:manage'], ['all:manage', 'setting:manage'])).toBe(true)
  })
})

describe('filterByPermission', () => {
  const nav = [
    { title: 'Dashboard' },
    { title: 'Users', permission: 'user:read' },
    {
      title: 'System',
      items: [
        { title: 'Roles', permission: 'role:read' },
        { title: 'Models', permission: 'embedding-model:read' },
      ],
    },
  ]

  it('hides entries without permission and empty groups', () => {
    const can = (permission: string) => hasPermission(['user:read'], permission)
    expect(filterByPermission(nav, can).map(item => item.title)).toEqual(['Dashboard', 'Users'])
  })

  it('keeps permitted children only', () => {
    const can = (permission: string) => hasPermission(['role:read'], permission)
    const result = filterByPermission(nav, can)
    expect(result.map(item => item.title)).toEqual(['Dashboard', 'System'])
    expect(result[1]!.items!.map(item => item.title)).toEqual(['Roles'])
    expect(nav[2]!.items).toHaveLength(2)
  })
})
