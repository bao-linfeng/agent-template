import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Badge } from '@repo/ui/components/badge'
import dayjs from 'dayjs'
import { h } from 'vue'

import type { DataTableColumnDef } from '@/components/data-table'
import type { IAdminUser } from '@/services/types/user.type'

import { DataTableColumnHeader } from '@/components/data-table'
import { Copy } from '@/components/prop-ui/copy'
import { initialsOf } from '@/lib/avatar'

import { userStatuses } from '../data/data'
import DataTableRowActions from './data-table-row-actions.vue'

function formatDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
}

export function createColumns(options: { canEdit: boolean }): DataTableColumnDef<IAdminUser>[] {
  const columns: DataTableColumnDef<IAdminUser>[] = [
    {
      accessorKey: 'nickname',
      header: ({ column }) => h(DataTableColumnHeader<IAdminUser>, { column, title: 'User' }),
      cell: ({ row }) => h('div', { class: 'flex items-center gap-2' }, [
        h(Avatar, { class: 'size-8' }, () => [
          row.original.avatarUrl && h(AvatarImage, { src: row.original.avatarUrl, alt: row.original.nickname }),
          h(AvatarFallback, () => initialsOf(row.original.nickname)),
        ]),
        h('span', { class: 'font-medium' }, row.original.nickname),
      ]),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => h(DataTableColumnHeader<IAdminUser>, { column, title: 'Email' }),
      cell: ({ row }) => h('div', {}, [
        h('span', {}, row.original.email),
        h(Copy, { class: 'ml-2', size: 'icon-xs', content: row.original.email }),
      ]),
      enableSorting: false,
    },
    {
      id: 'roles',
      header: ({ column }) => h(DataTableColumnHeader<IAdminUser>, { column, title: 'Roles' }),
      cell: ({ row }) => h('div', { class: 'flex flex-wrap gap-1' }, row.original.roles.map(role =>
        h(Badge, { key: role.id, variant: 'secondary', title: role.code }, () => role.name),
      )),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => h(DataTableColumnHeader<IAdminUser>, { column, title: 'Status' }),
      cell: ({ row }) => {
        const status = userStatuses.find(item => item.value === row.original.status)
        return status ? h(Badge, { class: status.style, variant: 'outline' }, () => status.label) : null
      },
      enableSorting: false,
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => h(DataTableColumnHeader<IAdminUser>, { column, title: 'Last sign-in' }),
      cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, formatDate(row.original.lastLoginAt)),
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => h(DataTableColumnHeader<IAdminUser>, { column, title: 'Registered' }),
      cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, formatDate(row.original.createdAt)),
      enableSorting: false,
    },
  ]

  if (options.canEdit) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => h(DataTableRowActions, { row }),
    })
  }
  return columns
}
