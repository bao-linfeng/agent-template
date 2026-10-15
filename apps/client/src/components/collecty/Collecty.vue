<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@repo/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('relative inline-flex', props.class)">
    <slot />
  </div>
</template>
