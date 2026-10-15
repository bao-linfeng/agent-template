<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@repo/utils'
import { RouterLink } from 'vue-router'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <RouterLink
    to="/"
    :class="cn('flex items-center gap-2 hover:opacity-80 transition-opacity', $props.class)"
  >
    <slot />
  </RouterLink>
</template>
