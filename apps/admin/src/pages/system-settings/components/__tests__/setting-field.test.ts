// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import type { SettingInput } from '@/lib/system-settings'
import type { ISettingView } from '@/services/api/settings.api'

import { i18n, setLocale } from '@/plugins/i18n'

import SettingField from '../setting-field.vue'

function view(overrides: Partial<ISettingView>): ISettingView {
  return {
    key: 'account.deletionGraceDays',
    value: 15,
    defaultValue: 15,
    overridden: false,
    public: false,
    description: '服务端说明',
    schema: { type: 'integer', minimum: 0, maximum: 365 },
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  }
}

function mountField(props: { view: ISettingView, modelValue: SettingInput, problem?: { message: string, params?: Record<string, unknown> } }) {
  return mount(SettingField, { props, global: { plugins: [i18n] } })
}

describe('setting field', () => {
  afterEach(() => setLocale('en'))

  it('shows the translated title, default and bounds of a number setting', () => {
    setLocale('en')
    const wrapper = mountField({ view: view({}), modelValue: '15' })
    expect(wrapper.text()).toContain('Deletion grace period (days)')
    expect(wrapper.text()).toContain('Default: 15')
    expect(wrapper.text()).toContain('Range 0–365')
    expect(wrapper.find('input').element.value).toBe('15')
    expect(wrapper.text()).not.toContain('Unsaved')
    wrapper.unmount()
  })

  it('falls back to the key and the server description for unknown settings', () => {
    const wrapper = mountField({ view: view({ key: 'future.flag', schema: { type: 'boolean' }, value: true, defaultValue: true }), modelValue: true })
    expect(wrapper.text()).toContain('future.flag')
    expect(wrapper.text()).toContain('服务端说明')
    wrapper.unmount()
  })

  it('reports edits and shows problems', async () => {
    const wrapper = mountField({ view: view({}), modelValue: '15' })
    await wrapper.find('input').setValue('400')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['400'])

    await wrapper.setProps({ modelValue: '400', problem: { message: 'systemSettings.invalid.range', params: { min: 0, max: 365 } } })
    expect(wrapper.text()).toContain('Unsaved')
    expect(wrapper.text()).toContain('Enter a value between 0 and 365.')
    wrapper.unmount()
  })

  it('offers a reset only for changed settings', async () => {
    const plain = mountField({ view: view({}), modelValue: '15' })
    expect(plain.find('button').exists()).toBe(false)
    plain.unmount()

    const changed = mountField({ view: view({ value: 3, overridden: true, updatedAt: '2026-10-16T08:00:00.000Z' }), modelValue: '3' })
    expect(changed.text()).toContain('Changed')
    await changed.find('button').trigger('click')
    expect(changed.emitted('reset')).toHaveLength(1)
    changed.unmount()
  })
})
