const THEME_CLASS_PREFIX = 'theme-'

/**
 * Switch the `theme-*` color class on an element (the document root by default),
 * keeping unrelated classes such as `dark` untouched.
 */
export function applyThemeClass(theme: string, el: Element = document.documentElement): void {
  const stale = [...el.classList].filter(className => className.startsWith(THEME_CLASS_PREFIX))
  el.classList.remove(...stale)
  el.classList.add(`${THEME_CLASS_PREFIX}${theme}`)
}
