<script setup lang="ts">
import type { VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'vue'
import { cn } from '@repo/utils'
import { cva } from 'class-variance-authority'

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
})

const containerVariants = cva(
  'container mx-auto',
  {
    variants: {
      size: {
        'sm': 'max-w-(--breakpoint-sm)',
        'md': 'max-w-(--breakpoint-md)',
        'lg': 'max-w-(--breakpoint-lg)',
        'xl': 'max-w-(--breakpoint-xl)',
        '2xl': 'max-w-(--breakpoint-2xl)',
      },
      padding: {
        none: '',
        sm: 'px-4 md:px-6 lg:px-8',
        md: 'px-6 md:px-8 lg:px-12',
        lg: 'px-8 md:px-12 lg:px-16',
      },
    },
    defaultVariants: {
      size: 'xl',
      padding: 'md',
    },
  },
)

type ContainerVariants = VariantProps<typeof containerVariants>

interface Props extends /* @vue-ignore */ ContainerVariants {
  class?: HTMLAttributes['class']
  as?: string
}

defineExpose({
  containerVariants,
})
</script>

<template>
  <component
    :is="as"
    :class="cn(containerVariants({ size: props.size, padding: props.padding }), props.class)"
  >
    <slot />
  </component>
</template>
