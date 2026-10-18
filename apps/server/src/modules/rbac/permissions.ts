/**
 * Permission catalog of the admin console. Only admin accounts (`admin_users`) have roles; client users
 * have no permissions and can only act on their own data. Roles store permission codes
 * (`<subject>:<action>`); the CASL ability is built from them in `ability.ts`. To protect a new resource:
 *   1. add its subject to SUBJECTS and its codes to PERMISSIONS,
 *   2. guard `@AdminController` routes with `@RequirePermissions('<subject>:<action>')`.
 */
export const ACTIONS = ['manage', 'create', 'read', 'update', 'delete'] as const
export type Action = (typeof ACTIONS)[number]

/** Permission-code prefix → CASL subject type. */
export const SUBJECTS = {
  all: 'all',
  user: 'User',
  admin: 'Admin',
  role: 'Role',
  'embedding-model': 'EmbeddingModel',
  'knowledge-base': 'KnowledgeBase',
  'audit-log': 'AuditLog',
  setting: 'Setting',
  announcement: 'Announcement',
} as const
export type SubjectName = (typeof SUBJECTS)[keyof typeof SUBJECTS]

export const PERMISSIONS = {
  'all:manage': '全部权限（超级管理员）',
  'user:read': '查看客户端用户',
  'user:update': '编辑客户端用户资料与状态',
  'user:delete': '注销客户端用户或撤销其注销',
  'admin:read': '查看管理员账号',
  'admin:create': '创建管理员账号',
  'admin:update': '编辑管理员资料、状态与角色',
  'role:read': '查看角色',
  'role:create': '创建角色',
  'role:update': '编辑角色与角色权限',
  'role:delete': '删除角色',
  'embedding-model:read': '查看 Embedding 模型配置',
  'embedding-model:manage': '管理 Embedding 模型配置',
  'knowledge-base:read': '查看所有用户的知识库',
  'knowledge-base:manage': '管理所有用户的知识库',
  'audit-log:read': '查看审计日志',
  'setting:read': '查看系统设置',
  'setting:manage': '修改系统设置与功能开关',
  'announcement:read': '查看公告',
  'announcement:manage': '发布、编辑与删除公告',
} as const satisfies Record<string, string>
export type Permission = keyof typeof PERMISSIONS

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value)
}

export function parsePermission(permission: Permission): {
  action: Action
  subject: SubjectName
} {
  const separator = permission.lastIndexOf(':')
  const subjectKey = permission.slice(0, separator) as keyof typeof SUBJECTS
  return {
    subject: SUBJECTS[subjectKey],
    action: permission.slice(separator + 1) as Action,
  }
}

/** Roles created on startup when missing. `super_admin` permissions are always enforced. */
export const SYSTEM_ROLES = {
  superAdmin: {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有全部权限',
    permissions: ['all:manage'],
  },
  admin: {
    code: 'admin',
    name: '管理员',
    description: '管理客户端用户与查看系统配置',
    permissions: [
      'user:read',
      'user:update',
      'admin:read',
      'role:read',
      'embedding-model:read',
      'knowledge-base:read',
      'setting:read',
    ],
  },
} as const satisfies Record<
  string,
  { code: string; name: string; description: string; permissions: Permission[] }
>
