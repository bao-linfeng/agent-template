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
