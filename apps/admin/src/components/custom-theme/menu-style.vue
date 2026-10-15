<script setup lang="ts">
import { ChevronRightIcon, LayoutListIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { storeToRefs } from 'pinia'

import type { NavigationMode } from '@/stores/sidebar-config'

import { useSidebarConfigStore } from '@/stores/sidebar-config'

const sidebarConfigStore = useSidebarConfigStore()
const { navigationMode } = storeToRefs(sidebarConfigStore)

const menuStyles: Array<{
  value: NavigationMode
  label: string
  icon: any
  description: string
}> = [
  {
    value: 'collapsible',
    label: 'customTheme.menuStyles.collapsible',
    icon: LayoutListIcon,
    description: 'customTheme.menuStyles.collapsibleDescription',
  },
  {
    value: 'vercel',
    label: 'customTheme.menuStyles.vercel',
    icon: ChevronRightIcon,
    description: 'customTheme.menuStyles.vercelDescription',
  },
]

function handleMenuStyleChange(style: NavigationMode) {
  sidebarConfigStore.setNavigationMode(style)
}
</script>

<template>
  <div class="space-y-1.5 pt-6">
    <Label for="menu-style" class="text-xs">
      {{ $t('customTheme.menuStyle') }}
    </Label>
    <div class="grid grid-cols-2 gap-2 py-1.5">
      <Button
        v-for="style in menuStyles"
        :key="style.value"
        variant="outline"
        class="justify-center h-8 px-3"
        :class="navigationMode === style.value ? 'border-foreground border-2' : ''"
        :title="$t(style.description)"
        @click="handleMenuStyleChange(style.value)"
      >
        <component :is="style.icon" class="w-4 h-4" />
        {{ $t(style.label) }}
      </Button>
    </div>
  </div>
</template>
