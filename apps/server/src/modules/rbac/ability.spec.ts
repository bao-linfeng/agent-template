import { asSubject, canAny, defineAbilityFor } from './ability.js'
import {
  isPermission,
  parsePermission,
  PERMISSIONS,
  SYSTEM_ROLES,
} from './permissions.js'

describe('permission catalog', () => {
  it('parses every catalog code into a known action and subject', () => {
    for (const code of Object.keys(PERMISSIONS)) {
      expect(isPermission(code)).toBe(true)
      const { action, subject } = parsePermission(
        code as keyof typeof PERMISSIONS,
      )
      expect(action).toMatch(/^(manage|create|read|update|delete)$/)
      expect(subject).toBeTruthy()
    }
    expect(parsePermission('knowledge-base:manage')).toEqual({
      action: 'manage',
      subject: 'KnowledgeBase',
    })
    expect(parsePermission('admin:create')).toEqual({
      action: 'create',
      subject: 'Admin',
    })
  })

  it('only references catalog codes from system roles', () => {
    for (const role of Object.values(SYSTEM_ROLES)) {
      expect(
        role.permissions.every((permission) => isPermission(permission)),
      ).toBe(true)
    }
  })
})

describe('defineAbilityFor', () => {
  const me = '11111111-1111-1111-1111-111111111111'
  const other = '22222222-2222-2222-2222-222222222222'

  it('grants nothing without permissions', () => {
    const ability = defineAbilityFor({ id: me, permissions: [] })
    expect(ability.rules).toHaveLength(0)
    expect(ability.can('read', 'User')).toBe(false)
    expect(canAny(ability, 'read', 'Admin')).toBe(false)
  })

  it('turns permission codes into unconditional rules', () => {
    const reader = defineAbilityFor({ id: me, permissions: ['user:read'] })
    expect(canAny(reader, 'read', 'User')).toBe(true)
    expect(canAny(reader, 'update', 'User')).toBe(false)
    expect(canAny(reader, 'read', 'Admin')).toBe(false)
    expect(reader.can('read', asSubject('User', { id: other }))).toBe(true)
  })

  it('treats all:manage as every action on every subject', () => {
    const admin = defineAbilityFor({ id: me, permissions: ['all:manage'] })
    expect(canAny(admin, 'delete', 'Role')).toBe(true)
    expect(canAny(admin, 'manage', 'EmbeddingModel')).toBe(true)
    expect(canAny(admin, 'create', 'Admin')).toBe(true)
    expect(
      admin.can('delete', asSubject('KnowledgeBase', { ownerId: other })),
    ).toBe(true)
  })

  it('expands manage permissions to all actions on that subject', () => {
    const ability = defineAbilityFor({
      id: me,
      permissions: ['knowledge-base:manage'],
    })
    expect(canAny(ability, 'delete', 'KnowledgeBase')).toBe(true)
    expect(canAny(ability, 'read', 'KnowledgeBase')).toBe(true)
    expect(canAny(ability, 'read', 'User')).toBe(false)
  })

  it('ignores unknown permission codes stored in the database', () => {
    const ability = defineAbilityFor({
      id: me,
      permissions: ['legacy:thing', 'knowledge-base:create', 'user:read'],
    })
    expect(ability.rules).toHaveLength(1)
  })
})
