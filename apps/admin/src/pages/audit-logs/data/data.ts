import dayjs from 'dayjs'

import type { AuditOutcome, AuditRealm, IAuditLog } from '@/services/api/audit-logs.api'

import { userStatuses } from '@/pages/users/data/data'
import { i18n, t } from '@/plugins/i18n'

/** `label` is a vue-i18n message key. */
export const auditRealms = [
  { value: 'admin', label: 'auditLogs.realms.admin' },
  { value: 'user', label: 'auditLogs.realms.user' },
] satisfies { value: AuditRealm, label: string }[]

export const auditOutcomes = [
  { value: 'success', label: 'auditLogs.outcomes.success' },
  { value: 'failure', label: 'auditLogs.outcomes.failure' },
] satisfies { value: AuditOutcome, label: string }[]

// Same badge colors as the active/disabled account statuses.
export const outcomeStyles = {
  success: userStatuses[0].style,
  failure: userStatuses[1].style,
}

export function isFailure(log: Pick<IAuditLog, 'statusCode'>) {
  return log.statusCode >= 400
}

export function realmLabel(realm: AuditRealm | null) {
  return t(realm ? `auditLogs.realms.${realm}` : 'auditLogs.realms.none')
}

export function formatTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

/** Translated `apiErrors.<code>` message, or the bare code when there is no translation. */
export function errorLabel(code: string) {
  const key = `apiErrors.${code}`
  return i18n.global.te(key) ? t(key) : code
}
