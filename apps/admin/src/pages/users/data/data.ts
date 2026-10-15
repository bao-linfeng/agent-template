import type { UserStatus } from '@/services/types/user.type'

/** `label` is a vue-i18n message key. */
export const userStatuses = [
  {
    label: 'status.active',
    value: 'active',
    style: 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  },
  {
    label: 'status.disabled',
    value: 'disabled',
    style: 'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  },
] satisfies { label: string, value: UserStatus, style: string }[]
