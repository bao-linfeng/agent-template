/**
 * Permission catalog. Roles store permission codes (`<subject>:<action>`); the CASL ability is built
 * from them in `ability.ts`. To protect a new resource:
 *   1. add its subject to SUBJECTS and its codes to PERMISSIONS,
 *   2. guard routes with `@RequirePermissions('<subject>:<action>')`,
 *   3. for per-record rules (ownership) add them in `defineAbilityFor`.
 */
export const ACTIONS = [
  'manage',
  'create',
  'read',
  'update',
  'delete',
] as const;
export type Action = (typeof ACTIONS)[number];

/** Permission-code prefix → CASL subject type. */
export const SUBJECTS = {
  all: 'all',
  user: 'User',
  role: 'Role',
  'embedding-model': 'EmbeddingModel',
  'knowledge-base': 'KnowledgeBase',
} as const;
export type SubjectName = (typeof SUBJECTS)[keyof typeof SUBJECTS];

export const PERMISSIONS = {
  'all:manage': '全部权限（超级管理员）',
  'user:read': '查看用户列表与详情',
  'user:update': '编辑用户资料、状态与角色',
  'role:read': '查看角色',
  'role:create': '创建角色',
  'role:update': '编辑角色与角色权限',
  'role:delete': '删除角色',
  'embedding-model:read': '查看 Embedding 模型配置',
  'embedding-model:manage': '管理 Embedding 模型配置',
  'knowledge-base:create': '创建自己的知识库',
  'knowledge-base:read': '查看所有知识库',
  'knowledge-base:manage': '管理所有知识库',
} as const satisfies Record<string, string>;
export type Permission = keyof typeof PERMISSIONS;

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}

export function parsePermission(permission: Permission): {
  action: Action;
  subject: SubjectName;
} {
  const separator = permission.lastIndexOf(':');
  const subjectKey = permission.slice(0, separator) as keyof typeof SUBJECTS;
  return {
    subject: SUBJECTS[subjectKey],
    action: permission.slice(separator + 1) as Action,
  };
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
    description: '管理用户与查看系统配置',
    permissions: [
      'user:read',
      'user:update',
      'role:read',
      'embedding-model:read',
      'knowledge-base:read',
    ],
  },
  user: {
    code: 'user',
    name: '普通用户',
    description: '注册用户的默认角色',
    permissions: ['knowledge-base:create'],
  },
} as const satisfies Record<
  string,
  { code: string; name: string; description: string; permissions: Permission[] }
>;

export const DEFAULT_ROLE_CODE = SYSTEM_ROLES.user.code;
