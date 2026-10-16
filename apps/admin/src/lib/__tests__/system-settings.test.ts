import { describe, expect, it } from 'vitest'

import type { ISettingSchema, ISettingView } from '@/services/api/settings.api'

import {
  collectSettingChanges,
  fromSettingInput,
  groupSettings,
  isSettingDirty,
  settingControl,
  settingProblem,
  syncSettingInputs,
  toSettingInput,
} from '../system-settings'

const BOOLEAN: ISettingSchema = { type: 'boolean' }
const DAYS: ISettingSchema = { type: 'integer', minimum: 0, maximum: 365 }

function view(key: string, schema: ISettingSchema, value: unknown, defaultValue = value): ISettingView {
  return {
    key,
    value,
    defaultValue,
    overridden: !Object.is(value, defaultValue),
    public: false,
    description: '',
    schema,
    updatedAt: null,
    updatedBy: null,
  }
}

describe('settingControl', () => {
  it('picks a control from the JSON Schema', () => {
    expect(settingControl(BOOLEAN)).toBe('switch')
    expect(settingControl(DAYS)).toBe('integer')
    expect(settingControl({ type: 'number' })).toBe('number')
    expect(settingControl({ type: 'string' })).toBe('text')
    expect(settingControl({ type: 'string', enum: ['a', 'b'] })).toBe('select')
  })

  it('shows shapes it cannot edit read-only', () => {
    expect(settingControl({ type: 'array' })).toBe('readonly')
    expect(settingControl({ type: 'object' })).toBe('readonly')
    expect(settingControl({ anyOf: [] })).toBe('readonly')
  })
})

describe('setting inputs', () => {
  it('round-trips values through control states', () => {
    expect(toSettingInput(BOOLEAN, false)).toBe(false)
    expect(toSettingInput(DAYS, 15)).toBe('15')
    expect(toSettingInput({ type: 'string' }, 'hi')).toBe('hi')
    expect(fromSettingInput(BOOLEAN, true)).toBe(true)
    expect(fromSettingInput(DAYS, ' 7 ')).toBe(7)
    expect(fromSettingInput(DAYS, 7)).toBe(7)
  })

  it('turns blank or malformed numbers into NaN', () => {
    expect(fromSettingInput(DAYS, '')).toBeNaN()
    expect(fromSettingInput(DAYS, 'ten')).toBeNaN()
  })
})

describe('settingProblem', () => {
  it('checks numbers against type and bounds', () => {
    expect(settingProblem(DAYS, 0)).toBeUndefined()
    expect(settingProblem(DAYS, 365)).toBeUndefined()
    expect(settingProblem(DAYS, Number.NaN)).toEqual({ message: 'systemSettings.invalid.number' })
    expect(settingProblem(DAYS, 1.5)).toEqual({ message: 'systemSettings.invalid.integer' })
    expect(settingProblem(DAYS, 366)).toEqual({ message: 'systemSettings.invalid.range', params: { min: 0, max: 365 } })
    expect(settingProblem({ type: 'number', minimum: 1 }, 0)).toEqual({ message: 'systemSettings.invalid.min', params: { min: 1 } })
    expect(settingProblem({ type: 'number', maximum: 1 }, 2)).toEqual({ message: 'systemSettings.invalid.max', params: { max: 1 } })
  })

  it('checks options, text length and booleans', () => {
    expect(settingProblem({ type: 'string', enum: ['a'] }, 'b')).toEqual({ message: 'systemSettings.invalid.option' })
    expect(settingProblem({ type: 'string', maxLength: 2 }, 'abc')).toEqual({ message: 'systemSettings.invalid.length', params: { min: 0, max: 2 } })
    expect(settingProblem({ type: 'string', minLength: 1 }, 'a')).toBeUndefined()
    expect(settingProblem(BOOLEAN, 'yes')).toEqual({ message: 'systemSettings.invalid.boolean' })
  })
})

describe('collectSettingChanges', () => {
  const views = [
    view('auth.registrationEnabled', BOOLEAN, true),
    view('account.deletionGraceDays', DAYS, 15),
    view('maintenance.authRecordRetentionDays', DAYS, 30),
    view('feature.list', { type: 'array' }, ['a']),
  ]

  it('sends only edited settings, with parsed values', () => {
    const { changes, problems } = collectSettingChanges(views, {
      'auth.registrationEnabled': false,
      'account.deletionGraceDays': '3',
      'maintenance.authRecordRetentionDays': ' 30 ',
      'feature.list': '["b"]',
    })
    expect(changes).toEqual({ 'auth.registrationEnabled': false, 'account.deletionGraceDays': 3 })
    expect(problems).toEqual({})
  })

  it('reports invalid edits instead of sending them', () => {
    const { changes, problems } = collectSettingChanges(views, {
      'account.deletionGraceDays': '400',
      'maintenance.authRecordRetentionDays': '',
    })
    expect(changes).toEqual({})
    expect(Object.keys(problems)).toEqual(['account.deletionGraceDays', 'maintenance.authRecordRetentionDays'])
  })
})

describe('syncSettingInputs', () => {
  it('follows server values but keeps edits in progress', () => {
    const before = [view('account.deletionGraceDays', DAYS, 15), view('maintenance.authRecordRetentionDays', DAYS, 30)]
    const after = [view('account.deletionGraceDays', DAYS, 2), view('maintenance.authRecordRetentionDays', DAYS, 60)]
    const synced = syncSettingInputs(after, before, {
      'account.deletionGraceDays': '15',
      'maintenance.authRecordRetentionDays': '45',
    })
    expect(synced).toEqual({ 'account.deletionGraceDays': '2', 'maintenance.authRecordRetentionDays': '45' })
  })

  it('initializes every setting on the first load', () => {
    expect(syncSettingInputs([view('auth.registrationEnabled', BOOLEAN, false)], undefined, {}))
      .toEqual({ 'auth.registrationEnabled': false })
  })

  it('drops an edit once it has been saved', () => {
    const saved = view('account.deletionGraceDays', DAYS, 3, 15)
    const synced = syncSettingInputs([saved], [view('account.deletionGraceDays', DAYS, 15)], { 'account.deletionGraceDays': '3' })
    expect(isSettingDirty(saved, synced['account.deletionGraceDays'])).toBe(false)
  })
})

describe('groupSettings', () => {
  it('groups by the first key segment in server order', () => {
    const groups = groupSettings([
      view('auth.registrationEnabled', BOOLEAN, true),
      view('account.deletionGraceDays', DAYS, 15),
      view('auth.other', BOOLEAN, true),
    ])
    expect(groups.map(({ group, views }) => [group, views.map(item => item.key)])).toEqual([
      ['auth', ['auth.registrationEnabled', 'auth.other']],
      ['account', ['account.deletionGraceDays']],
    ])
  })
})
