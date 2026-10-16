import type { ISettingSchema, ISettingView, SettingChanges } from '@/services/api/settings.api'

/** Form control for a setting, chosen from its JSON Schema; `readonly` shapes are shown, not edited. */
export type SettingControl = 'switch' | 'integer' | 'number' | 'select' | 'text' | 'readonly'

/** What a control holds while editing: switches a boolean, every other control the typed text. */
export type SettingInput = string | boolean

/** A failed check, as an i18n message key with its parameters. */
export interface SettingProblem {
  message: string
  params?: Record<string, unknown>
}

export function settingControl(schema: ISettingSchema): SettingControl {
  if (Array.isArray(schema.enum) && schema.enum.length && schema.enum.every(option => typeof option === 'string'))
    return 'select'
  switch (schema.type) {
    case 'boolean': return 'switch'
    case 'integer': return 'integer'
    case 'number': return 'number'
    case 'string': return 'text'
    default: return 'readonly'
  }
}

/** Initial control state for a value. */
export function toSettingInput(schema: ISettingSchema, value: unknown): SettingInput {
  if (settingControl(schema) === 'switch')
    return value === true
  if (typeof value === 'string')
    return value
  return value === undefined || value === null ? '' : JSON.stringify(value)
}

/** The value a control state stands for; numbers that do not parse become `NaN` (and fail the check). */
export function fromSettingInput(schema: ISettingSchema, input: SettingInput | number): unknown {
  switch (settingControl(schema)) {
    case 'switch':
      return input === true
    case 'integer':
    case 'number': {
      if (typeof input === 'number')
        return input
      const text = String(input).trim()
      return text === '' ? Number.NaN : Number(text)
    }
    default:
      return input
  }
}

/** Client-side mirror of the server schema, so obvious mistakes are flagged before saving. */
export function settingProblem(schema: ISettingSchema, value: unknown): SettingProblem | undefined {
  const control = settingControl(schema)
  if (control === 'switch')
    return typeof value === 'boolean' ? undefined : { message: 'systemSettings.invalid.boolean' }
  if (control === 'integer' || control === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return { message: 'systemSettings.invalid.number' }
    if (control === 'integer' && !Number.isInteger(value))
      return { message: 'systemSettings.invalid.integer' }
    const { minimum: min, maximum: max } = schema
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      if (min !== undefined && max !== undefined)
        return { message: 'systemSettings.invalid.range', params: { min, max } }
      return min !== undefined
        ? { message: 'systemSettings.invalid.min', params: { min } }
        : { message: 'systemSettings.invalid.max', params: { max } }
    }
    return undefined
  }
  if (control === 'select')
    return schema.enum!.includes(value) ? undefined : { message: 'systemSettings.invalid.option' }
  if (control === 'text') {
    if (typeof value !== 'string')
      return { message: 'systemSettings.invalid.text' }
    const { minLength: min = 0, maxLength: max } = schema
    if (value.length < min || (max !== undefined && value.length > max))
      return { message: 'systemSettings.invalid.length', params: { min, max: max ?? '∞' } }
  }
  return undefined
}

export function sameSettingValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b))
}

/** Whether a control holds something other than the setting's current value. */
export function isSettingDirty(view: ISettingView, input: SettingInput | undefined): boolean {
  return input !== undefined && !sameSettingValue(fromSettingInput(view.schema, input), view.value)
}

/** The edited settings as a `PATCH /settings` body, plus the problems that block saving it. */
export function collectSettingChanges(views: ISettingView[], inputs: Record<string, SettingInput>) {
  const changes: SettingChanges = {}
  const problems: Record<string, SettingProblem> = {}
  for (const view of views) {
    if (settingControl(view.schema) === 'readonly' || !isSettingDirty(view, inputs[view.key]))
      continue
    const value = fromSettingInput(view.schema, inputs[view.key]!)
    const problem = settingProblem(view.schema, value)
    if (problem)
      problems[view.key] = problem
    else
      changes[view.key] = value
  }
  return { changes, problems }
}

/**
 * Control states after the server list changed (load, save, refetch): settings the admin has not
 * edited follow the new values, edits in progress are kept.
 */
export function syncSettingInputs(
  next: ISettingView[],
  previous: ISettingView[] | undefined,
  inputs: Record<string, SettingInput>,
): Record<string, SettingInput> {
  const before = new Map(previous?.map(view => [view.key, view]))
  const synced: Record<string, SettingInput> = {}
  for (const view of next) {
    const old = before.get(view.key)
    const input = inputs[view.key]
    synced[view.key] = old && input !== undefined && isSettingDirty(old, input)
      ? input
      : toSettingInput(view.schema, view.value)
  }
  return synced
}

/** Settings grouped by the first segment of their key (`auth`, `account`, ...), in server order. */
export function groupSettings(views: ISettingView[]): { group: string, views: ISettingView[] }[] {
  const groups = new Map<string, ISettingView[]>()
  for (const view of views) {
    const group = view.key.split('.')[0]!
    groups.set(group, [...(groups.get(group) ?? []), view])
  }
  return [...groups].map(([group, items]) => ({ group, views: items }))
}
