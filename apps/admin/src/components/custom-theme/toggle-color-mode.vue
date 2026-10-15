<script setup lang="ts">
import type { BasicColorSchema } from '@vueuse/core'
import type { Component } from 'vue'

import { MoonIcon, SunIcon, SunMoonIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { useColorMode } from '@vueuse/core'

const mode = useColorMode()

const colorModes: {
  colorMode: BasicColorSchema
  label: string
  icon: Component
}[] = [
  { colorMode: 'light', label: 'theme.light', icon: SunIcon },
  { colorMode: 'dark', label: 'theme.dark', icon: MoonIcon },
  { colorMode: 'auto', label: 'theme.system', icon: SunMoonIcon },
]

function setColorMode(colorMode: BasicColorSchema) {
  mode.value = colorMode
}
</script>

<template>
  <div class="space-y-1.5 pt-6">
    <Label for="radius" class="text-xs">
      {{ $t('customTheme.colorMode') }}
    </Label>
    <div class="grid grid-cols-3 gap-2 py-1.5">
      <Button
        v-for="item in colorModes" :key="item.colorMode"
        variant="outline"
        class="justify-center items-center h-8 px-3"
        :class="item.colorMode === mode ? 'border-foreground border-2' : ''"
        @click="setColorMode(item.colorMode)"
      >
        <component :is="item.icon" />
        <span class="text-xs">{{ $t(item.label) }}</span>
      </Button>
    </div>
  </div>
</template>
