import { applyThemeClass } from '@repo/utils'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useThemeStore } from '@/stores/theme'

export function useSystemTheme() {
  const themeStore = useThemeStore()
  const { setTheme, setRadius } = themeStore
  const { theme, radius } = storeToRefs(themeStore)

  if (typeof document !== 'undefined') {
    watch(theme, theme => applyThemeClass(theme), { immediate: true })

    watch(radius, (radius) => {
      document.documentElement.style.setProperty('--radius', `${radius}rem`)
    }, { immediate: true })
  }

  return {
    theme,
    radius,
    setTheme,
    setRadius,
  }
}
