import type { UserStatus } from '@/services/types/user.type'

export const userStatuses = [
  {
    label: 'Active',
    value: 'active',
    style: 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  },
  {
    label: 'Disabled',
    value: 'disabled',
    style: 'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  },
] satisfies { label: string, value: UserStatus, style: string }[]
