// @vitest-environment happy-dom
import dayjs from 'dayjs'
import { afterEach, describe, expect, it } from 'vitest'

import type { NavSubItem } from '@/components/app-sidebar/types'

import { navData, otherPages } from '@/constants/sidebar-data'
import { appLocale, DEFAULT_LOCALE, i18n, setLocale, t } from '@/plugins/i18n'

import en from '../en.json'
import zh from '../zh.json'

function keysOf(messages: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' ? keysOf(value as Record<string, unknown>, path) : [path]
  })
}

function navTitles(items: readonly NavSubItem[]): string[] {
  return items.flatMap(item => [item.title, ...navTitles(item.items ?? [])])
}

afterEach(() => {
  setLocale(DEFAULT_LOCALE)
})

describe('messages', () => {
  it('defines the same keys in every locale', () => {
    expect(keysOf(zh).sort()).toEqual(keysOf(en).sort())
  })

  it('has a message for every navigation title', () => {
    const titles = [...navData, ...otherPages].flatMap(group => [group.title, ...navTitles(group.items)])
    for (const title of titles) {
      expect(i18n.global.te(title, 'en'), title).toBe(true)
      expect(i18n.global.te(title, 'zh'), title).toBe(true)
    }
  })
})

describe('setLocale', () => {
  it('switches messages, dayjs, <html lang> and the stored choice together', () => {
    setLocale('zh')

    expect(i18n.global.locale.value).toBe('zh')
    expect(t('nav.users')).toBe('用户')
    expect(dayjs.locale()).toBe('zh-cn')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(appLocale.value).toBe('zh')

    setLocale('en')

    expect(t('nav.users')).toBe('Users')
    expect(dayjs.locale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(appLocale.value).toBe('en')
  })

  it('falls back to the default locale for unsupported values', () => {
    setLocale('zh')
    setLocale('fr')

    expect(i18n.global.locale.value).toBe(DEFAULT_LOCALE)
    expect(appLocale.value).toBe(DEFAULT_LOCALE)
  })
})
