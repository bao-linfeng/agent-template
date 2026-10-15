<script setup lang="ts">
import { MoonIcon, SunIcon, SunMoonIcon } from '@lucide/vue'
import { CommandGroup, CommandItem } from '@repo/ui/components/command'
import { useColorMode } from '@vueuse/core'

import CommandItemHasIcon from './command-item-has-icon.vue'

defineEmits<{
  click: []
}>()

const mode = useColorMode()
</script>

<template>
  <CommandGroup heading="Theme">
    <CommandItem value="light" @click="mode = 'light', $emit('click')">
      <CommandItemHasIcon name="Light" :icon="SunIcon" />
    </CommandItem>
    <CommandItem value="dark" @click="mode = 'dark', $emit('click')">
      <CommandItemHasIcon name="Dark" :icon="MoonIcon" />
    </CommandItem>
    <CommandItem value="system" @click="mode = 'auto', $emit('click')">
      <CommandItemHasIcon name="System" :icon="SunMoonIcon" />
    </CommandItem>
  </CommandGroup>
</template>
