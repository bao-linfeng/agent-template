import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'

import type { IAnnouncement } from '@/services/api/announcements.api'

import { announcementChanges, fromLocalInput, nextHourInput, scheduleError, toCreateBody, toCreateRequest, toFormValues, toLocalInput } from '../announcements'

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
    expect(toFormValues()).toEqual({
      title: '',
      body: '',
      level: 'info',
      audience: 'all',
      expiresAt: '',
      publishMode: 'draft',
      publishAt: '',
    })
    expect(toFormValues(announcement)).toEqual({
      title: 'Maintenance',
      body: 'Tonight',
      level: 'warning',
      audience: 'user',
      expiresAt: '2030-01-02T03:04',
      publishMode: 'draft',
      publishAt: '',
    })
  })

  it('trims new announcements and omits a missing expiry', () => {
    expect(toCreateBody({ ...toFormValues(), title: ' Hi ', body: ' There ' })).toEqual({
      title: 'Hi',
      body: 'There',
      level: 'info',
      audience: 'all',
    })
  })

  it('adds what the publish mode asks for when creating', () => {
    const values = { ...toFormValues(), title: 'Hi', body: 'There', publishAt: '2030-01-02T03:04' }
    expect(toCreateRequest(values)).not.toHaveProperty('publish')
    expect(toCreateRequest(values)).not.toHaveProperty('publishAt')
    expect(toCreateRequest({ ...values, publishMode: 'now' })).toMatchObject({ publish: true })
    expect(toCreateRequest({ ...values, publishMode: 'now' })).not.toHaveProperty('publishAt')
    const scheduled = toCreateRequest({ ...values, publishMode: 'schedule' })
    expect(scheduled).toMatchObject({ publishAt: EXPIRES })
    expect(scheduled).not.toHaveProperty('publish')
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

describe('scheduling', () => {
  const now = dayjs('2030-01-01T10:20').toDate()

  it('suggests the next full hour', () => {
    expect(nextHourInput(now)).toBe('2030-01-01T11:00')
    expect(nextHourInput(dayjs('2030-01-01T10:00').toDate())).toBe('2030-01-01T11:00')
  })

  it('needs a time in the future that comes before the expiry', () => {
    expect(scheduleError('2030-01-01T11:00', '', now)).toBeNull()
    expect(scheduleError('2030-01-01T11:00', '2030-01-01T12:00', now)).toBeNull()
    expect(scheduleError('', '', now)).toBe('futureTime')
    expect(scheduleError('2030-01-01T10:20', '', now)).toBe('futureTime')
    expect(scheduleError('2030-01-01T11:00', '2030-01-01T11:00', now)).toBe('beforeExpiry')
    expect(scheduleError('2030-01-01T11:00', '2030-01-01T10:59', now)).toBe('beforeExpiry')
  })
})
