<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import type { HeroVariants } from './variants'
import type { SectionData } from '@/types/collecty'

import { cn } from '@repo/utils'
import { computed, provide, ref } from 'vue'

import { Collecty, CollectyTrigger } from '@/components/collecty'
import Section from '@/components/layout/Section.vue'
import { useCollecty } from '@/composables/useCollecty'

import { heroVariants } from './variants'

interface Props extends HeroVariants {
  class?: HTMLAttributes['class']
  sectionKey: string
}

const props = withDefaults(defineProps<Props>(), {
  align: 'center',
  layout: 'default',
  container: 'full',
  height: 'medium',
  background: 'none',
  spacing: 'none',
})

const { isInCollection, addToCollection, removeFromCollection } = useCollecty()

// Guards against double clicks while a toggle is being processed
const isProcessing = ref(false)

const sectionId = computed(() => `hero__${props.sectionKey}`)
const inCollection = computed(() => isInCollection(sectionId.value))

provide<SectionData>('section-data', {
  id: sectionId,
  isInCollection: inCollection,
  toggleCollection: () => {
    if (isProcessing.value)
      return

    isProcessing.value = true
    try {
      if (inCollection.value)
        removeFromCollection(sectionId.value)
      else
        addToCollection(sectionId.value, window.location.pathname)
    }
    finally {
      setTimeout(() => {
        isProcessing.value = false
      }, 300)
    }
  },
})
</script>

<template>
  <Section
    :class="cn(
      heroVariants({
        align: props.align,
        height: props.height,
        background: props.background,
        spacing: props.spacing,
      }),
      'flex flex-col relative',
      props.class,
    )"
  >
    <Collecty class="absolute top-2 right-2 z-10">
      <CollectyTrigger />
    </Collecty>
    <div
      :class="cn(
        heroVariants({
          container: props.container,
          layout: props.layout,
        }),
        'flex-1',
      )"
    >
      <slot />
    </div>
  </Section>
</template>
