import type { App } from 'vue'

import { appLocale, i18n, setLocale } from '.'

export function setupI18n(app: App) {
  setLocale(appLocale.value)
  app.use(i18n)
}
