import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'

import type { IAnnouncement } from '@/services/api/announcements.api'

import { announcementChanges, fromLocalInput, toCreateBody, toFormValues, toLocalInput } from '../announcements'

const EXPIRES = dayjs('2030-01-02T03:04').toISOString()

const announcement: IAnnouncement = {
  id: 'a1',
  title: 'Maintenance',
  body: 'Tonight',
  level: 'warning',
  audience: 'user',
  status: 'draft',
  publishedAt: null,
  expiresAt: EXPIRES,
  createdBy: null,
  updatedBy: null,
  readCount: 0,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
}

describe('datetime-local conversion', () => {
  it('round-trips local minutes', () => {
    expect(toLocalInput(EXPIRES)).toBe('2030-01-02T03:04')
    expect(fromLocalInput('2030-01-02T03:04')).toBe(EXPIRES)
  })

  it('treats empty and invalid input as no expiry', () => {
    expect(toLocalInput(null)).toBe('')
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('soon')).toBeNull()
  })
})

describe('announcement form', () => {
  it('starts with defaults or the announcement', () => {
    expect(toFormValues()).toEqual({ title: '', body: '', level: 'info', audience: 'all', expiresAt: '' })
    expect(toFormValues(announcement)).toEqual({
      title: 'Maintenance',
      body: 'Tonight',
      level: 'warning',
      audience: 'user',
      expiresAt: '2030-01-02T03:04',
    })
  })

  it('trims new announcements and omits a missing expiry', () => {
    expect(toCreateBody({ title: ' Hi ', body: ' There ', level: 'info', audience: 'all', expiresAt: '' })).toEqual({
      title: 'Hi',
      body: 'There',
      level: 'info',
      audience: 'all',
    })
  })

  it('sends only changed fields and null for a cleared expiry', () => {
    expect(announcementChanges(announcement, toFormValues(announcement))).toEqual({})
    expect(announcementChanges(announcement, { ...toFormValues(announcement), title: 'Moved', expiresAt: '' })).toEqual({
      title: 'Moved',
      expiresAt: null,
    })
    expect(announcementChanges({ ...announcement, expiresAt: null }, { ...toFormValues(announcement), audience: 'all' })).toEqual({
      audience: 'all',
      expiresAt: EXPIRES,
    })
  })
})
