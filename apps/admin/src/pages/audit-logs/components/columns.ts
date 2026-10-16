import { EyeIcon } from '@lucide/vue'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { h } from 'vue'

import type { DataTableColumnDef } from '@/components/data-table'
import type { IAuditLog } from '@/services/api/audit-logs.api'

import { DataTableColumnHeader } from '@/components/data-table'
import { t } from '@/plugins/i18n'

import { errorLabel, formatTime, isFailure, outcomeStyles, realmLabel } from '../data/data'

function header(title: string): DataTableColumnDef<IAuditLog>['header'] {
  return ({ column }) => h(DataTableColumnHeader<IAuditLog>, { column, title: t(title) })
}

export function createColumns(options: { onView: (log: IAuditLog) => void }): DataTableColumnDef<IAuditLog>[] {
  return [
    {
      accessorKey: 'createdAt',
      header: header('auditLogs.fields.time'),
      cell: ({ row }) => h('span', { class: 'whitespace-nowrap text-muted-foreground' }, formatTime(row.original.createdAt)),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'actorEmail',
      header: header('auditLogs.fields.actor'),
      cell: ({ row }) => h('div', { class: 'flex flex-col gap-1' }, [
        row.original.actorEmail
          ? h('span', { class: 'font-medium' }, row.original.actorEmail)
          : h('span', { class: 'text-muted-foreground' }, t('auditLogs.anonymous')),
        h(Badge, { variant: 'outline', class: 'w-fit' }, () => realmLabel(row.original.realm)),
      ]),
      enableSorting: false,
    },
    {
      accessorKey: 'action',
      header: header('auditLogs.fields.operation'),
      cell: ({ row }) => h('div', { class: 'flex max-w-[420px] flex-col gap-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h(Badge, { variant: 'secondary', class: 'font-mono' }, () => row.original.method),
          h('span', { class: 'truncate font-mono text-xs' }, row.original.action),
        ]),
        h('span', { class: 'truncate text-xs text-muted-foreground', title: row.original.path }, row.original.path),
      ]),
      enableSorting: false,
    },
    {
      accessorKey: 'statusCode',
      header: header('auditLogs.fields.result'),
      cell: ({ row }) => {
        const failed = isFailure(row.original)
        return h('div', { class: 'flex flex-col gap-1' }, [
          h(Badge, { variant: 'outline', class: ['w-fit', outcomeStyles[failed ? 'failure' : 'success']] }, () => String(row.original.statusCode)),
          row.original.errorCode && h('span', { class: 'max-w-[220px] truncate text-xs text-muted-foreground', title: row.original.errorCode }, errorLabel(row.original.errorCode)),
        ])
      },
      enableSorting: false,
    },
    {
      accessorKey: 'ip',
      header: header('auditLogs.fields.ip'),
      cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, row.original.ip ?? '—'),
      enableSorting: false,
    },
    {
      accessorKey: 'durationMs',
      header: header('auditLogs.fields.duration'),
      cell: ({ row }) => h('span', { class: 'whitespace-nowrap text-muted-foreground' }, t('auditLogs.durationMs', { value: row.original.durationMs })),
      enableSorting: false,
    },
    {
      id: 'actions',
      cell: ({ row }) => h(Button, {
        'variant': 'ghost',
        'size': 'icon-sm',
        'title': t('auditLogs.view'),
        'aria-label': t('auditLogs.view'),
        'onClick': () => options.onView(row.original),
      }, () => h(EyeIcon, { class: 'size-4' })),
      enableHiding: false,
    },
  ]
}
