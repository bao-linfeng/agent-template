/** Grants every permission (`super_admin`). */
export const ALL_PERMISSIONS = 'all:manage'

/**
 * Mirrors the server's CASL rules for permission codes `<subject>:<action>`: `manage` covers every
 * action and the `all` subject covers every subject.
 */
export function hasPermission(granted: readonly string[], required: string): boolean {
  const [subject, action] = required.split(':')
  return granted.some(code =>
    code === required
    || code === ALL_PERMISSIONS
    || code === `${subject}:manage`
    || code === `all:${action}`,
  )
}

/**
 * Whether `granted` includes every permission in `required`, i.e. whether the admin may hand them out
 * (in a role or by assigning a role): the server rejects grants beyond the own permissions with
 * `PERMISSIONS_EXCEED_OWN`.
 */
export function coversPermissions(granted: readonly string[], required: readonly string[]): boolean {
  return required.every(permission => hasPermission(granted, permission))
}

interface PermissionNode {
  permission?: string
  items?: readonly PermissionNode[]
}

/** Recursively keeps entries whose `permission` (if any) is granted; drops entries whose children all got removed. */
export function filterByPermission<T extends PermissionNode>(
  items: readonly T[],
  can: (permission: string) => boolean,
): T[] {
  return items.flatMap((item) => {
    if (item.permission && !can(item.permission))
      return []
    if (!item.items)
      return [item]
    const children = filterByPermission(item.items, can)
    return children.length ? [{ ...item, items: children }] : []
  })
}
