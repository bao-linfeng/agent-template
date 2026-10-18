import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'

import type { INotification } from '@/services/api/notifications.api'

import { categoryLabel, formatNotificationParams, isAppLink, notificationText, streamAction } from '../notifications'

function notification(overrides: Partial<INotification>): INotification {
  return {
    id: 'n1',
    type: 'security.passwordChanged',
    category: 'security',
    params: {},
    title: 'Server title',
    body: 'Server body',
    link: null,
    readAt: null,
    createdAt: '2026-10-18T08:00:00.000Z',
    ...overrides,
  }
}

describe('notificationText', () => {
  it('translates known types with their parameters', () => {
    expect(notificationText(notification({ type: 'security.twoFactorChanged', params: { change: 'reset' } }))).toEqual({
      title: 'Two-factor authentication changed',
      body: 'Two-factor authentication of your account was reset by an administrator. If this was not you, contact an administrator.',
    })
  })

  it('shows dates of `*At` parameters in local time', () => {
    const expiresAt = '2026-10-21T03:00:00.000Z'
    const text = notificationText(notification({ type: 'account.exportReady', params: { exportId: 'e1', expiresAt } }))
    expect(text.body).toBe(`Download it before ${dayjs(expiresAt).format('YYYY-MM-DD HH:mm')}.`)
  })

  it('falls back to the server text for unknown types', () => {
    expect(notificationText(notification({ type: 'billing.invoicePaid' }))).toEqual({ title: 'Server title', body: 'Server body' })
  })
})

describe('formatNotificationParams', () => {
  it('keeps numbers and stringifies the rest', () => {
    expect(formatNotificationParams({ chunkCount: 3, title: 'Guide', createdAt: 'not a date', missing: null })).toEqual({
      chunkCount: 3,
      title: 'Guide',
      createdAt: 'not a date',
      missing: '',
    })
  })
})

describe('categoryLabel', () => {
  it('translates known categories and falls back to the description', () => {
    expect(categoryLabel('security')).toBe('Account security')
    expect(categoryLabel('billing', 'Invoices')).toBe('Invoices')
    expect(categoryLabel('billing')).toBe('billing')
  })
})

describe('isAppLink', () => {
  it('only accepts console routes', () => {
    expect(isAppLink('/settings/account')).toBe(true)
    for (const link of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test'])
      expect(isAppLink(link)).toBe(false)
  })
})

describe('streamAction', () => {
  it('refreshes on ready and sync, spreads announcement refreshes', () => {
    expect(streamAction({ event: 'ready', data: '{}' })).toEqual({ kind: 'refresh' })
    expect(streamAction({ event: 'sync', data: '{"reason":"read"}' })).toEqual({ kind: 'refresh' })
    expect(streamAction({ event: 'announcement', data: '{"id":"a1"}' }, () => 0.5)).toEqual({ kind: 'refreshLater', delayMs: 1500 })
    expect(streamAction({ event: 'message', data: 'x' })).toEqual({ kind: 'ignore' })
  })

  it('passes new notifications on, and refreshes when the payload is broken', () => {
    const view = notification({})
    expect(streamAction({ event: 'notification', data: JSON.stringify(view) })).toEqual({ kind: 'notify', notification: view })
    expect(streamAction({ event: 'notification', data: '{' })).toEqual({ kind: 'refresh' })
  })
})
