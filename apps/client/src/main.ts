import { createApp } from 'vue'

import { initializeTheme } from '@/components/theming/themeManager'
import { useCollecty } from '@/composables/useCollecty'
import { i18n } from '@/i18n'

import App from './App.vue'
import router from './router'

import '@/assets/index.css'
import './components/theming/themes.css'

// Initialize theme and collecty store
initializeTheme()
useCollecty()

const app = createApp(App)
app.use(i18n)
app.use(router)
app.mount('#app')
