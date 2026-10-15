import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zh from './locales/zh'

export type MessageSchema = typeof en
export type Locale = 'en' | 'zh'

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh']
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'locale'

/** Labels shown in the language switcher, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = { en: 'English', zh: '中文' }

export function isLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

/** `zh-CN` / `zh-Hant` → `zh`; unsupported tags are skipped. */
function matchLocale(tag: string): Locale | undefined {
  const base = tag.toLowerCase().split('-')[0]
  return isLocale(base) ? base : undefined
}

/** Stored choice first, then the browser languages in order of preference, then English. */
export function detectLocale(): Locale {
  const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY)
  if (isLocale(stored))
    return stored
  const preferred = globalThis.navigator?.languages ?? []
  for (const tag of preferred) {
    const locale = matchLocale(tag)
    if (locale)
      return locale
  }
  return DEFAULT_LOCALE
}

export const i18n = createI18n<[MessageSchema], Locale, false>({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, zh },
})

/** For code outside components (validation, API fallbacks); components use `useI18n()`. */
export const { t } = i18n.global

function syncDocumentLang(locale: Locale) {
  if (typeof document !== 'undefined')
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale
}

syncDocumentLang(i18n.global.locale.value)

/** Switches the UI language and remembers it for the next visit. */
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  syncDocumentLang(locale)
}
