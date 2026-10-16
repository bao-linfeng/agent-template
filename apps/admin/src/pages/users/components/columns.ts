import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Badge } from '@repo/ui/components/badge'
import dayjs from 'dayjs'
import { h } from 'vue'

import type { DataTableColumnDef } from '@/components/data-table'
import type { IClientUser, IPublicUser } from '@/services/types/user.type'

import { DataTableColumnHeader } from '@/components/data-table'
import { Copy } from '@/components/prop-ui/copy'
import { initialsOf } from '@/lib/avatar'
import { t } from '@/plugins/i18n'

import { userStatuses } from '../data/data'
import DataTableRowActions from './data-table-row-actions.vue'

function formatDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
}

/** Columns shared by the client user and admin account tables. */
export function accountColumns<T extends IPublicUser>(): DataTableColumnDef<T>[] {
  return [
    {
      accessorKey: 'nickname',
      header: ({ column }) => h(DataTableColumnHeader<T>, { column, title: t('accounts.user') }),
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
      header: ({ column }) => h(DataTableColumnHeader<T>, { column, title: t('email') }),
      cell: ({ row }) => h('div', {}, [
        h('span', {}, row.original.email),
        h(Copy, { class: 'ml-2', size: 'icon-xs', content: row.original.email }),
      ]),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => h(DataTableColumnHeader<T>, { column, title: t('fields.status') }),
      cell: ({ row }) => {
        const status = userStatuses.find(item => item.value === row.original.status)
        const { deletionScheduledAt } = row.original
        return h('div', { class: 'flex flex-wrap gap-1' }, [
          status && h(Badge, { class: status.style, variant: 'outline' }, () => t(status.label)),
          deletionScheduledAt && h(Badge, { variant: 'destructive' }, () => t('users.deletionOn', { date: formatDate(deletionScheduledAt) })),
        ])
      },
      enableSorting: false,
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => h(DataTableColumnHeader<T>, { column, title: t('accounts.lastSignIn') }),
      cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, formatDate(row.original.lastLoginAt)),
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => h(DataTableColumnHeader<T>, { column, title: t('accounts.created') }),
      cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, formatDate(row.original.createdAt)),
      enableSorting: false,
    },
  ]
}

export function createColumns(options: { canEdit: boolean, canDelete: boolean }): DataTableColumnDef<IClientUser>[] {
  const columns = accountColumns<IClientUser>()
  if (options.canEdit || options.canDelete) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => h(DataTableRowActions, { row, canEdit: options.canEdit, canDelete: options.canDelete }),
    })
  }
  return columns
}
