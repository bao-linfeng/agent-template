// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'

import { applyThemeState, currentTheme, generateTailwindStyles, getStoredThemeState, initializeTheme } from '../themeManager'
import { themes } from '../themes'

function storedSceleton() {
  return JSON.parse(localStorage.getItem('currentState')!).sceleton
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.style.removeProperty('--radius')
  document.head.innerHTML = ''
})

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

describe('getStoredThemeState', () => {
  it('falls back to defaults when the stored state is missing or corrupt', () => {
    expect(getStoredThemeState()).toEqual({ theme: 'green', radius: '0.5rem', font: 'Nunito' })

    localStorage.setItem('currentState', '{not json')
    expect(getStoredThemeState()).toEqual({ theme: 'green', radius: '0.5rem', font: 'Nunito' })
  })
})

describe('initializeTheme', () => {
  it('falls back to defaults and persists them when nothing is stored', () => {
    initializeTheme()

    expect(storedSceleton()).toMatchObject({ theme: 'green', radius: '0.5rem' })
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

  it('does not crash on a corrupt stored state', () => {
    localStorage.setItem('currentState', '{not json')

    expect(() => initializeTheme()).not.toThrow()
    expect(storedSceleton().theme).toBe('green')
  })
})

describe('applyThemeState', () => {
  it('switches the theme and keeps unrelated stored data for BuildY', () => {
    localStorage.setItem('currentState', JSON.stringify({ other: 1, sceleton: { custom: true } }))
    document.documentElement.classList.add('dark', 'theme-green')

    applyThemeState({ theme: 'violet', radius: '0.75rem', font: 'Inter' })

    const state = JSON.parse(localStorage.getItem('currentState')!)
    expect(state.other).toBe(1)
    expect(state.sceleton).toMatchObject({ custom: true, theme: 'violet', radius: '0.75rem' })
    expect(state.sceleton.config.theme.fontFamily.sans).toEqual(['Inter', 'sans-serif'])
    expect(state.sceleton.tailwindStyles).toContain('--radius: 0.75rem;')
    expect(document.documentElement.className).toBe('dark theme-violet')
  })
})
