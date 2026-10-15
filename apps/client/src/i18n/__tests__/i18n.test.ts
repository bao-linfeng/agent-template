// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkEmail } from '@/lib/validation'
import { detectLocale, i18n, LOCALE_STORAGE_KEY, setLocale } from '..'

function preferLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages)
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  i18n.global.locale.value = 'en'
})

describe('detectLocale', () => {
  it('prefers the stored choice', () => {
    preferLanguages(['en-US'])
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh')
    expect(detectLocale()).toBe('zh')
  })

  it('ignores an unsupported stored value', () => {
    preferLanguages(['zh-CN'])
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    expect(detectLocale()).toBe('zh')
  })

  it('takes the first supported browser language', () => {
    preferLanguages(['fr-FR', 'zh-Hant-TW', 'en'])
    expect(detectLocale()).toBe('zh')
  })

  it('falls back to English', () => {
    preferLanguages(['fr-FR', 'de'])
    expect(detectLocale()).toBe('en')
    preferLanguages([])
    expect(detectLocale()).toBe('en')
  })
})

describe('setLocale', () => {
  it('switches messages, remembers the choice and updates <html lang>', () => {
    setLocale('zh')
    expect(i18n.global.locale.value).toBe('zh')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(checkEmail('')).toBe('请输入邮箱。')

    setLocale('en')
    expect(document.documentElement.lang).toBe('en')
    expect(checkEmail('')).toBe('Please enter your email.')
  })
})
