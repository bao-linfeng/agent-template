// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'

import { applyThemeClass } from '../theme'

describe('applyThemeClass', () => {
  beforeEach(() => {
    document.documentElement.className = ''
  })

  it('replaces any existing theme class and keeps unrelated classes', () => {
    document.documentElement.classList.add('dark', 'theme-blue', 'theme-zinc')

    applyThemeClass('green')

    expect(document.documentElement.className).toBe('dark theme-green')
  })

  it('targets the given element instead of the document root', () => {
    const el = document.createElement('div')
    el.className = 'card theme-red'

    applyThemeClass('violet', el)

    expect(el.className).toBe('card theme-violet')
    expect(document.documentElement.className).toBe('')
  })
})
