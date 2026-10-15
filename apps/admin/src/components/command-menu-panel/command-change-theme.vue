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
  <CommandGroup :heading="$t('header.themeGroup')">
    <CommandItem value="light" @click="mode = 'light', $emit('click')">
      <CommandItemHasIcon :name="$t('theme.light')" :icon="SunIcon" />
    </CommandItem>
    <CommandItem value="dark" @click="mode = 'dark', $emit('click')">
      <CommandItemHasIcon :name="$t('theme.dark')" :icon="MoonIcon" />
    </CommandItem>
    <CommandItem value="system" @click="mode = 'auto', $emit('click')">
      <CommandItemHasIcon :name="$t('theme.system')" :icon="SunMoonIcon" />
    </CommandItem>
  </CommandGroup>
</template>
