// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'

import { applyThemeClass, currentTheme, generateTailwindStyles, initializeTheme } from '../themeManager'
import { themes } from '../themes'

describe('generateTailwindStyles', () => {
  it('returns an empty string for an unknown theme', () => {
    expect(generateTailwindStyles('does-not-exist', '0.5rem')).toBe('')
  })

  it('emits light and dark CSS variables with the given radius', () => {
    const theme = themes[0]
    const styles = generateTailwindStyles(theme.name, '1rem')
    const [lightKey, lightValue] = Object.entries(theme.cssVars.light)[0]
    const [darkKey, darkValue] = Object.entries(theme.cssVars.dark)[0]

    expect(styles).toContain(':root {')
    expect(styles).toContain('--radius: 1rem;')
    expect(styles).toContain(`--${lightKey}: ${lightValue};`)
    expect(styles.slice(styles.indexOf('.dark {'))).toContain(`--${darkKey}: ${darkValue};`)
  })
})

describe('applyThemeClass', () => {
  beforeEach(() => {
    document.documentElement.className = ''
  })

  it('replaces any existing theme class and keeps unrelated classes', () => {
    document.documentElement.classList.add('dark', 'theme-blue')

    applyThemeClass('green')

    expect(document.documentElement.className).toBe('dark theme-green')
  })
})

describe('initializeTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    document.head.innerHTML = ''
  })

  it('falls back to defaults and persists them when nothing is stored', () => {
    initializeTheme()

    const state = JSON.parse(localStorage.getItem('currentState')!)
    expect(state.sceleton).toMatchObject({ theme: 'green', radius: '0.5rem' })
    expect(currentTheme.value).toBe('green')
    expect(document.documentElement.classList.contains('theme-green')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('0.5rem')
    expect(document.querySelector('link[data-font]')?.getAttribute('data-font')).toBe('Nunito')
  })

  it('restores the stored theme, radius and font', () => {
    localStorage.setItem('currentState', JSON.stringify({
      sceleton: {
        theme: 'blue',
        radius: '1rem',
        config: { theme: { fontFamily: { sans: ['Inter'] } } },
      },
    }))

    initializeTheme()

    expect(currentTheme.value).toBe('blue')
    expect(document.documentElement.classList.contains('theme-blue')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('1rem')
    expect(document.querySelector('link[data-font]')?.getAttribute('data-font')).toBe('Inter')
  })
})
