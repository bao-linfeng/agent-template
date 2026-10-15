<script setup lang="ts">
import { Button as BaseButton } from '@repo/ui/components/button'
import { cn } from '@repo/utils'
import { buttonVariants } from './button'

interface Props {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
})
</script>

<template>
  <BaseButton
    v-bind="$attrs"
    :variant="variant"
    :size="size"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </BaseButton>
</template>
