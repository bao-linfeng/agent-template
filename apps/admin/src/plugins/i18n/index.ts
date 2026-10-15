import { useStorage } from '@vueuse/core'
import dayjs from 'dayjs'
import { createI18n } from 'vue-i18n'

import en from './en.json'
import zh from './zh.json'

import 'dayjs/locale/zh-cn'

export type Language = 'en' | 'zh'

export const SUPPORTED_LOCALES = new Set<Language>([
  'en',
  'zh',
])

export const DEFAULT_LOCALE: Language = 'en'

const DAYJS_LOCALES: Record<Language, string> = {
  en: 'en',
  zh: 'zh-cn',
}

const HTML_LANGS: Record<Language, string> = {
  en: 'en',
  zh: 'zh-CN',
}

export const appLocale = useStorage<Language>('app-locale', DEFAULT_LOCALE)

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && SUPPORTED_LOCALES.has(value as Language)
}

export function validateAppLocale() {
  if (!isLanguage(appLocale.value)) {
    appLocale.value = DEFAULT_LOCALE
  }
}

validateAppLocale()

type MessageSchema = typeof en

export const i18n = createI18n<[MessageSchema], Language, false>({
  legacy: false,
  locale: appLocale.value,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    zh,
    en,
  },
})

/** Translates outside components (validators, toasts, table column headers). */
export const t = i18n.global.t

/** Switches vue-i18n, dayjs and `<html lang>` together and remembers the choice. */
export function setLocale(value: unknown) {
  const locale = isLanguage(value) ? value : DEFAULT_LOCALE
  // dayjs first: re-renders triggered by the i18n locale must already format with the new locale.
  dayjs.locale(DAYJS_LOCALES[locale])
  i18n.global.locale.value = locale
  appLocale.value = locale
  if (typeof document !== 'undefined')
    document.documentElement.lang = HTML_LANGS[locale]
}
