import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dayRangeQuery, fetchAuditLog, fetchAuditLogs } from '../audit-logs.api'

const apiFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', () => ({ apiFetch }))

describe('audit log transport', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue(undefined)
  })

  it('lists entries without empty filters', async () => {
    await fetchAuditLogs({ page: 2, pageSize: 20, keyword: '', realm: 'admin', outcome: undefined, actorId: 'a1' })
    expect(apiFetch).toHaveBeenCalledWith('/audit-logs', {
      method: 'get',
      query: { page: 2, pageSize: 20, realm: 'admin', actorId: 'a1' },
    })
  })

  it('reads one entry', async () => {
    await fetchAuditLog('log-1')
    expect(apiFetch).toHaveBeenCalledWith('/audit-logs/log-1', { method: 'get' })
  })
})

describe('dayRangeQuery', () => {
  it('includes both local days', () => {
    expect(dayRangeQuery('2026-10-01', '2026-10-03')).toEqual({
      from: dayjs('2026-10-01T00:00:00').toISOString(),
      to: dayjs('2026-10-04T00:00:00').toISOString(),
    })
  })

  it('leaves missing bounds open', () => {
    expect(dayRangeQuery(undefined, '')).toEqual({ from: undefined, to: undefined })
    expect(dayRangeQuery('', '2026-10-03').from).toBeUndefined()
  })
})
