import { applyThemeClass } from '@repo/utils'
import { ref } from 'vue'

import { useFont } from '@/composables/useFont'

import { themes } from './themes'

export interface ThemeState {
  theme: string
  radius: string
  font: string
}

export const DEFAULT_THEME_STATE: ThemeState = {
  theme: 'green',
  radius: '0.5rem',
  font: 'Nunito',
}

// Shared with the BuildY page builder in public/buildy, which reads `currentState.sceleton`
const STORAGE_KEY = 'currentState'

export const currentTheme = ref('')

const { loadFont, updateFontLink } = useFont()

export function generateTailwindStyles(theme: string, radius: string) {
  const themeConfig = themes.find(t => t.name === theme)
  if (!themeConfig)
    return ''

  const lightVars = Object.entries(themeConfig.cssVars.light)
    .map(([key, value]) => `    --${key}: ${value};`)
    .join('\n')

  const darkVars = Object.entries(themeConfig.cssVars.dark)
    .map(([key, value]) => `    --${key}: ${value};`)
    .join('\n')

  return `@layer base {
  :root {
${lightVars}
    --radius: ${radius};
  }

  .dark {
${darkVars}
  }
}`
}

/** Tailwind 3 config consumed by BuildY, whose CDN build still expects `hsl(var(--token))` colors */
function createBuildyConfig(font: string) {
  const color = (name: string) => ({
    DEFAULT: `hsl(var(--${name}))`,
    foreground: `hsl(var(--${name}-foreground))`,
  })

  return {
    darkMode: 'class',
    theme: {
      fontFamily: {
        sans: [font, 'sans-serif'],
      },
      container: {
        center: true,
        padding: '2rem',
      },
      extend: {
        colors: {
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          primary: color('primary'),
          secondary: color('secondary'),
          destructive: color('destructive'),
          muted: color('muted'),
          accent: color('accent'),
          popover: color('popover'),
          card: color('card'),
        },
        borderRadius: {
          xl: 'calc(var(--radius) + 4px)',
          lg: 'var(--radius)',
          md: 'calc(var(--radius) - 2px)',
          sm: 'calc(var(--radius) - 4px)',
        },
      },
    },
  }
}

function readStoredState(): Record<string, any> {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return state && typeof state === 'object' ? state : {}
  }
  catch {
    return {}
  }
}

export function getStoredThemeState(): ThemeState {
  const sceleton = readStoredState().sceleton
  return {
    theme: sceleton?.theme || DEFAULT_THEME_STATE.theme,
    radius: sceleton?.radius || DEFAULT_THEME_STATE.radius,
    font: sceleton?.config?.theme?.fontFamily?.sans?.[0] || DEFAULT_THEME_STATE.font,
  }
}

/** Apply theme color, radius and font to the page and persist them for the next visit and BuildY */
export async function applyThemeState({ theme, radius, font }: ThemeState) {
  const state = readStoredState()
  state.sceleton = {
    ...state.sceleton,
    config: createBuildyConfig(font),
    theme,
    radius,
    tailwindStyles: generateTailwindStyles(theme, radius),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

  currentTheme.value = theme
  document.documentElement.style.setProperty('--radius', radius)
  applyThemeClass(theme)

  updateFontLink(font)
  await loadFont(font)
}

export function initializeTheme() {
  return applyThemeState(getStoredThemeState())
}
