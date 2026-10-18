import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryLabel, isAppLink, notificationsApi, notificationText, streamRefreshDelay } from '../notifications'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function request(index = 0) {
  const [url, init] = fetchMock.mock.calls[index]! as [string, RequestInit]
  const parsed = new URL(url)
  return { path: parsed.pathname.replace(/^.*\/v1\/client/, ''), search: parsed.search, method: init.method ?? 'GET', body: init.body }
}

describe('notifications transport', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('lists notifications in the client realm without empty filters', async () => {
    fetchMock.mockResolvedValue(json({ items: [], total: 0, page: 1, pageSize: 20 }))
    await notificationsApi.list({ page: 2, unread: true, pageSize: undefined })
    expect(request()).toMatchObject({ path: '/notifications', search: '?page=2&unread=true', method: 'GET' })
  })

  it('marks, deletes and updates preferences', async () => {
    fetchMock.mockImplementation(async () => json({ updated: 1 }))
    await notificationsApi.markRead('n1')
    await notificationsApi.markAllRead()
    await notificationsApi.remove('n1')
    await notificationsApi.markAnnouncementRead('a1')
    await notificationsApi.updatePreferences({ account: { email: false } })
    expect([0, 1, 2, 3, 4].map(index => request(index))).toMatchObject([
      { path: '/notifications/n1/read', method: 'POST' },
      { path: '/notifications/read-all', method: 'POST' },
      { path: '/notifications/n1', method: 'DELETE' },
      { path: '/notifications/announcements/a1/read', method: 'POST' },
      { path: '/notifications/preferences', method: 'PATCH', body: JSON.stringify({ preferences: { account: { email: false } } }) },
    ])
  })

  it('opens the event stream as a raw body', async () => {
    const body = new ReadableStream()
    fetchMock.mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
    const signal = new AbortController().signal
    expect(await notificationsApi.stream(signal)).toBeInstanceOf(ReadableStream)
    expect(request()).toMatchObject({ path: '/notifications/stream', method: 'GET' })
  })
})

describe('notification text', () => {
  const base = { params: {}, title: 'Server title', body: 'Server body' }

  it('translates known types with their parameters', () => {
    expect(notificationText({ ...base, type: 'knowledgeBase.documentReady', params: { title: 'Guide', chunkCount: 3 } })).toEqual({
      title: 'Document ready',
      body: '"Guide" was indexed into 3 chunks and can be searched now.',
    })
  })

  it('shows `*At` parameters as localized dates', () => {
    const expiresAt = '2026-10-21T03:00:00.000Z'
    const date = new Date(expiresAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
    expect(notificationText({ ...base, type: 'account.exportReady', params: { expiresAt } }).body)
      .toBe(`Download it on your account page before ${date}.`)
  })

  it('falls back to the server text for unknown types', () => {
    expect(notificationText({ ...base, type: 'billing.invoicePaid' })).toEqual({ title: 'Server title', body: 'Server body' })
  })

  it('labels categories', () => {
    expect(categoryLabel('account')).toBe('Account')
    expect(categoryLabel('billing', 'Invoices')).toBe('Invoices')
  })
})

describe('stream helpers', () => {
  it('only follows routes of this app', () => {
    expect(isAppLink('/account')).toBe(true)
    for (const link of [null, 'https://evil.test', '//evil.test', '/\\evil.test'])
      expect(isAppLink(link)).toBe(false)
  })

  it('refreshes right away, or later for announcements', () => {
    expect(streamRefreshDelay({ event: 'ready', data: '{}' })).toBe(0)
    expect(streamRefreshDelay({ event: 'notification', data: '{}' })).toBe(0)
    expect(streamRefreshDelay({ event: 'announcement', data: '{}' }, () => 0.5)).toBe(1500)
    expect(streamRefreshDelay({ event: 'message', data: '' })).toBeNull()
  })
})
