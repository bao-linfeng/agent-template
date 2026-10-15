<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@repo/utils'
import { cva } from 'class-variance-authority'

const props = withDefaults(defineProps<Props>(), {
  rounded: 'sm',
  shadow: 'none',
  aspectRatio: 'auto',
  overlay: 'none',
})

const mediaVariants = cva(
  'relative overflow-hidden',
  {
    variants: {
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-lg',
        md: 'rounded-2xl',
        lg: 'rounded-[2rem]',
      },
      shadow: {
        none: '',
        sm: 'shadow-md',
        md: 'shadow-xl',
        lg: 'shadow-2xl',
      },
      aspectRatio: {
        square: 'aspect-square',
        video: 'aspect-video',
        portrait: 'aspect-[3/4]',
        auto: '',
      },
      overlay: {
        none: '',
        light: 'bg-background/50',
        dark: 'bg-background/80',
        gradient: 'bg-linear-to-tr from-primary/20 to-primary/5',
      },
    },
    defaultVariants: {
      rounded: 'sm',
      shadow: 'none',
      aspectRatio: 'auto',
      overlay: 'none',
    },
  },
)

interface Props {
  class?: HTMLAttributes['class']
  rounded?: 'none' | 'sm' | 'md' | 'lg'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto'
  overlay?: 'none' | 'light' | 'dark' | 'gradient'
}
</script>

<template>
  <div
    :class="cn(
      mediaVariants({
        rounded: props.rounded,
        shadow: props.shadow,
        aspectRatio: props.aspectRatio,
        overlay: props.overlay,
      }),
      props.class,
    )"
  >
    <slot />
  </div>
</template>
