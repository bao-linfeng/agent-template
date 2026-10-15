import { Badge } from '@repo/ui/components/badge'
import { h } from 'vue'

import type { DataTableColumnDef } from '@/components/data-table'
import type { IAdminAccount } from '@/services/types/user.type'

import { DataTableColumnHeader } from '@/components/data-table'
import { accountColumns } from '@/pages/users/components/columns'
import { t } from '@/plugins/i18n'

import DataTableRowActions from './data-table-row-actions.vue'

export function createColumns(options: { canEdit: boolean }): DataTableColumnDef<IAdminAccount>[] {
  const columns = accountColumns<IAdminAccount>()
  // Roles go right after the email column.
  columns.splice(2, 0, {
    id: 'roles',
    header: ({ column }) => h(DataTableColumnHeader<IAdminAccount>, { column, title: t('fields.roles') }),
    cell: ({ row }) => h('div', { class: 'flex flex-wrap gap-1' }, row.original.roles.map(role =>
      h(Badge, { key: role.id, variant: 'secondary', title: role.code }, () => role.name),
    )),
    enableSorting: false,
  })
  if (options.canEdit) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => h(DataTableRowActions, { row }),
    })
  }
  return columns
}
