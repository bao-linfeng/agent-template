<script setup lang="ts">
import type { BadgeVariants } from '@repo/ui/components/badge'
import type { HTMLAttributes } from 'vue'

import { badgeVariants } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'

import type { StatusVariants } from '.'

import Status from './Status.vue'

const props = defineProps<{
  variant?: BadgeVariants['variant']
  rounded?: StatusVariants['rounded']
  class?: HTMLAttributes['class']
  color?: StatusVariants['color']
}>()
</script>

<template>
  <div :class="cn(badgeVariants({ variant }), props.class)">
    <Status :color="props.color" :rounded="props.rounded" />
    <slot />
  </div>
</template>
