import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { initializeTheme } from '@/components/theming/themeManager'
import { useCollecty } from '@/composables/useCollecty'
import { i18n } from '@/i18n'
import { queryClient } from '@/lib/query-client'

import App from './App.vue'
import router from './router'

import '@/assets/index.css'
import './components/theming/themes.css'

// Initialize theme and collecty store
initializeTheme()
useCollecty()

const app = createApp(App)
// Pinia goes first: the router guard reads the session store on the initial navigation.
app.use(createPinia())
app.use(VueQueryPlugin, { queryClient })
app.use(i18n)
app.use(router)
app.mount('#app')
