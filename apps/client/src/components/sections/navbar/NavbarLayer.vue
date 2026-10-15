<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@repo/utils'
import { navbarLayerVariants } from './variants'

interface NavbarLayerProps {
  class?: HTMLAttributes['class']
  position?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<NavbarLayerProps>(), {
  position: 'start',
})
</script>

<template>
  <div :class="cn(navbarLayerVariants({ position: props.position }), props.class)">
    <slot />
  </div>
</template>
