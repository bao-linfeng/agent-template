<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { placeholderDark, placeholderLight } from './placeholders'

const props = withDefaults(defineProps<Props>(), {
  imageProps: () => ({
    rounded: false,
    shadow: false,
    fullHeight: false,
    aspectRatio: 'auto',
  }),
  imageLight: placeholderLight,
  imageDark: placeholderDark,
  badgeProps: () => ({
    variant: 'secondary',
    size: 'default',
    show: true,
  }),
})

interface ImageProps {
  rounded?: boolean
  shadow?: boolean
  fullHeight?: boolean
  aspectRatio?: 'square' | 'video' | 'auto'
  class?: HTMLAttributes['class']
}

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  show?: boolean
}

interface Props {
  class?: HTMLAttributes['class']
  title: string
  description: string
  category?: string
  date?: string
  imageLight?: string
  imageDark?: string
  href?: string
  imageProps?: ImageProps
  badgeProps?: BadgeProps
}

const { t } = useI18n()

const imageClasses = computed(() => {
  return cn(
    'absolute inset-0 w-full object-cover transition-transform duration-300 group-hover:scale-105',
    props.imageProps?.fullHeight ? 'h-full' : 'aspect-video',
    props.imageProps?.aspectRatio === 'square' && 'aspect-square',
    props.imageProps?.rounded && 'rounded-lg',
    props.imageProps?.shadow && 'shadow-xs',
  )
})

const containerClasses = computed(() => {
  return cn(
    'relative overflow-hidden',
    props.imageProps?.fullHeight
      ? 'sm:h-full sm:w-1/3 h-48'
      : 'h-44 sm:w-56',
    'shrink-0',
    props.imageProps?.rounded && 'rounded-lg',
  )
})
</script>

<template>
  <a
    :href="props.href"
    :class="cn(
      'group grid grid-rows-[auto_1fr] sm:grid-rows-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6 transition-all overflow-hidden',
      props.class,
    )"
  >
    <div :class="containerClasses">
      <img
        :src="props.imageLight"
        :alt="props.title"
        class="dark:hidden" :class="[imageClasses, props.imageProps?.class]"
      >
      <img
        :src="props.imageDark"
        :alt="props.title"
        class="hidden dark:block" :class="[imageClasses, props.imageProps?.class]"
      >
    </div>

    <div class="flex flex-col min-h-0">
      <div v-if="props.category && props.badgeProps?.show" class="mb-2 flex items-center gap-2">
        <Badge
          v-if="props.category && props.badgeProps?.show"
          :variant="props.badgeProps?.variant"
          :size="props.badgeProps?.size"
        >
          {{ props.category }}
        </Badge>
        <span v-if="props.date" class="text-sm text-muted-foreground">{{ props.date }}</span>
      </div>

      <h3 class="text-xl font-semibold text-foreground group-hover:text-primary">
        {{ props.title }}
      </h3>

      <p class="mt-2 text-muted-foreground line-clamp-2">{{ props.description }}</p>

      <div class="mt-4 flex items-center text-primary">
        {{ t('common.readMore') }}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="ml-1 h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
  </a>
</template>
