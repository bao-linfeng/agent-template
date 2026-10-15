<script setup lang="ts">
import type { VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'vue'
import { cn } from '@repo/utils'
import { cva } from 'class-variance-authority'

const props = withDefaults(defineProps<Props>(), {
  as: 'section',
})

const sectionVariants = cva(
  'relative w-full',
  {
    variants: {
      spacing: {
        none: '',
        sm: 'py-6 sm:py-8 lg:py-12',
        md: 'py-8 sm:py-12 lg:py-16',
        lg: 'py-12 sm:py-16 lg:py-24',
        xl: 'py-16 sm:py-24 lg:py-32',
      },
      background: {
        none: '',
        light: 'bg-muted/50 dark:bg-muted/10',
        dark: 'bg-muted dark:bg-muted/20',
      },
    },
    defaultVariants: {
      spacing: 'none',
      background: 'none',
    },
  },
)

type SectionVariants = VariantProps<typeof sectionVariants>

interface Props extends /* @vue-ignore */ SectionVariants {
  class?: HTMLAttributes['class']
  as?: string
}

defineExpose({
  sectionVariants,
})
</script>

<template>
  <component
    :is="props.as"
    :class="cn(sectionVariants({ spacing: props.spacing, background: props.background }), props.class)"
  >
    <slot />
  </component>
</template>
