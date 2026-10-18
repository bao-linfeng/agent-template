import { Badge } from '@repo/ui/components/badge'
import dayjs from 'dayjs'
import { h } from 'vue'

import type { DataTableColumnDef } from '@/components/data-table'
import type { IAnnouncement } from '@/services/api/announcements.api'

import { DataTableColumnHeader } from '@/components/data-table'
import { t } from '@/plugins/i18n'

import { announcementAudiences, announcementLevels, announcementStatuses } from '../data/data'
import DataTableRowActions from './data-table-row-actions.vue'

function formatDate(value: string | null, empty = '—') {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : empty
}

function header(title: string): DataTableColumnDef<IAnnouncement>['header'] {
  return ({ column }) => h(DataTableColumnHeader<IAnnouncement>, { column, title })
}

export function createColumns(options: { canManage: boolean }): DataTableColumnDef<IAnnouncement>[] {
  const columns: DataTableColumnDef<IAnnouncement>[] = [
    {
      accessorKey: 'title',
      header: header(t('announcements.fields.title')),
      cell: ({ row }) => h('div', { class: 'grid max-w-[420px] gap-0.5' }, [
        h('span', { class: 'font-medium truncate' }, row.original.title),
        h('span', { class: 'text-xs text-muted-foreground line-clamp-1' }, row.original.body),
      ]),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'status',
      header: header(t('announcements.fields.status')),
      cell: ({ row }) => {
        const status = announcementStatuses.find(item => item.value === row.original.status)
        return status ? h(Badge, { variant: status.variant }, () => t(status.label)) : row.original.status
      },
      enableSorting: false,
    },
    {
      accessorKey: 'level',
      header: header(t('announcements.fields.level')),
      cell: ({ row }) => {
        const level = announcementLevels.find(item => item.value === row.original.level)
        return level ? h(Badge, { variant: level.variant }, () => t(level.label)) : row.original.level
      },
      enableSorting: false,
    },
    {
      accessorKey: 'audience',
      header: header(t('announcements.fields.audience')),
      cell: ({ row }) => {
        const audience = announcementAudiences.find(item => item.value === row.original.audience)
        return audience ? t(audience.label) : row.original.audience
      },
      enableSorting: false,
    },
    {
      accessorKey: 'publishedAt',
      header: header(t('announcements.fields.publishedAt')),
      cell: ({ row }) => formatDate(row.original.publishedAt),
      enableSorting: false,
    },
    {
      accessorKey: 'expiresAt',
      header: header(t('announcements.fields.expiresAt')),
      cell: ({ row }) => formatDate(row.original.expiresAt, t('announcements.noExpiry')),
      enableSorting: false,
    },
    {
      accessorKey: 'readCount',
      header: header(t('announcements.fields.readCount')),
      cell: ({ row }) => row.original.readCount,
      enableSorting: false,
    },
  ]
  if (options.canManage) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => h(DataTableRowActions, { row }),
    })
  }
  return columns
}
