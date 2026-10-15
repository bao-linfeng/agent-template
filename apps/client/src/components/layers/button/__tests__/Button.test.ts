// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Button from '../Button.vue'

describe('Button', () => {
  it('renders a button with default variant classes and slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Save' } })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).toBe('Save')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['bg-primary', 'h-9']))
  })

  it('applies variant, size and custom classes, and forwards attrs', () => {
    const wrapper = mount(Button, {
      props: { variant: 'outline', size: 'sm', class: 'w-full' },
      attrs: { disabled: true },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['border', 'h-8', 'w-full']))
    expect(wrapper.classes()).not.toContain('bg-primary')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
