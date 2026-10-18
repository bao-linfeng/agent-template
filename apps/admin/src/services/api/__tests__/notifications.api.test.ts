import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
  withdrawAnnouncement,
} from '../announcements.api'
import {
  deleteNotification,
  fetchInboxAnnouncements,
  fetchNotificationPreferences,
  fetchNotifications,
  fetchUnreadCount,
  markAllAnnouncementsRead,
  markAllNotificationsRead,
  markAnnouncementRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../notifications.api'

const apiFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', () => ({ apiFetch }))

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockResolvedValue(undefined)
})

describe('notification inbox transport', () => {
  it('lists notifications without empty filters', async () => {
    await fetchNotifications({ page: 1, pageSize: 20, unread: true, category: undefined })
    expect(apiFetch).toHaveBeenCalledWith('/notifications', { method: 'get', query: { page: 1, pageSize: 20, unread: true } })
  })

  it('reads counts, marks and deletes', async () => {
    await fetchUnreadCount()
    await markNotificationRead('n1')
    await markAllNotificationsRead()
    await deleteNotification('n1')
    expect(apiFetch.mock.calls).toEqual([
      ['/notifications/unread-count', { method: 'get' }],
      ['/notifications/n1/read', { method: 'post' }],
      ['/notifications/read-all', { method: 'post' }],
      ['/notifications/n1', { method: 'delete' }],
    ])
  })

  it('wraps preference changes in `preferences`', async () => {
    await fetchNotificationPreferences()
    await updateNotificationPreferences({ account: { email: false } })
    expect(apiFetch.mock.calls).toEqual([
      ['/notifications/preferences', { method: 'get' }],
      ['/notifications/preferences', { method: 'patch', body: { preferences: { account: { email: false } } } }],
    ])
  })

  it('reads and marks announcements of the inbox', async () => {
    await fetchInboxAnnouncements({ pageSize: 8 })
    await markAnnouncementRead('a1')
    await markAllAnnouncementsRead()
    expect(apiFetch.mock.calls).toEqual([
      ['/notifications/announcements', { method: 'get', query: { pageSize: 8 } }],
      ['/notifications/announcements/a1/read', { method: 'post' }],
      ['/notifications/announcements/read-all', { method: 'post' }],
    ])
  })
})

describe('announcement administration transport', () => {
  it('lists, creates, edits, publishes, schedules, withdraws and deletes', async () => {
    await fetchAnnouncements({ status: 'draft', keyword: '', audience: 'user' })
    await createAnnouncement({ title: 'Hi', body: 'There', level: 'info', audience: 'all', publish: true })
    await updateAnnouncement('a1', { expiresAt: null })
    await publishAnnouncement({ id: 'a1' })
    await publishAnnouncement({ id: 'a1', publishAt: '2030-01-01T00:00:00.000Z' })
    await withdrawAnnouncement('a1')
    await deleteAnnouncement('a1')
    expect(apiFetch.mock.calls).toEqual([
      ['/announcements', { method: 'get', query: { status: 'draft', audience: 'user' } }],
      ['/announcements', { method: 'post', body: { title: 'Hi', body: 'There', level: 'info', audience: 'all', publish: true } }],
      ['/announcements/a1', { method: 'patch', body: { expiresAt: null } }],
      ['/announcements/a1/publish', { method: 'post' }],
      ['/announcements/a1/publish', { method: 'post', body: { publishAt: '2030-01-01T00:00:00.000Z' } }],
      ['/announcements/a1/withdraw', { method: 'post' }],
      ['/announcements/a1', { method: 'delete' }],
    ])
  })
})
