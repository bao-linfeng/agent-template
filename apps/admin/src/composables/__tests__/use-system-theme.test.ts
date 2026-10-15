// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useSystemTheme } from '../use-system-theme'

describe('useSystemTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.className = 'dark theme-blue'
    document.documentElement.style.removeProperty('--radius')
  })

  it('applies the stored theme class and radius immediately', () => {
    useSystemTheme()

    expect(document.documentElement.className).toBe('dark theme-zinc')
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('0.5rem')
  })

  it('swaps the theme class and radius when the store changes', async () => {
    const { setTheme, setRadius } = useSystemTheme()

    setTheme('violet')
    setRadius(1)
    await nextTick()

    expect(document.documentElement.className).toBe('dark theme-violet')
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('1rem')
  })
})
