<script setup lang="ts">
import { Separator } from '@repo/ui/components/separator'
import { SIDEBAR_COOKIE_NAME, SidebarInset, SidebarProvider, SidebarTrigger } from '@repo/ui/components/sidebar'
import { cn } from '@repo/ui/lib/utils'
import { useCookies } from '@vueuse/integrations/useCookies'
import { storeToRefs } from 'pinia'

import AppSidebar from '@/components/app-sidebar/index.vue'
import CommandMenuPanel from '@/components/command-menu-panel/index.vue'
import ThemePopover from '@/components/custom-theme/theme-popover.vue'
import LanguageChange from '@/components/language-change.vue'
import ToggleTheme from '@/components/toggle-theme.vue'
import { useThemeStore } from '@/stores/theme'

const defaultOpen = useCookies([SIDEBAR_COOKIE_NAME])
const themeStore = useThemeStore()
const { contentLayout } = storeToRefs(themeStore)
</script>

<template>
  <SidebarProvider :default-open="defaultOpen.get(SIDEBAR_COOKIE_NAME)">
    <AppSidebar />
    <SidebarInset class="w-full max-w-full peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)] peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]">
      <header
        class="flex items-center gap-3 sm:gap-4 h-14 p-4 shrink-0 transition-[width,height] ease-linear border-b sticky top-0 z-40 bg-background"
      >
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" />
        <CommandMenuPanel />
        <div class="flex-1" />
        <div class="ml-auto flex items-center space-x-2">
          <LanguageChange />
          <ToggleTheme />
          <ThemePopover />
        </div>
      </header>

      <main
        :class="cn(
          'p-4 grow relative',
          contentLayout === 'centered' ? 'container mx-auto ' : '',
        )"
      >
        <router-view />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
