<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SectionData } from '@/types/collecty'
import { cn } from '@repo/utils'
import { computed, inject } from 'vue'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const sectionData = inject<SectionData>('section-data')
const isActive = computed(() => sectionData?.isInCollection.value || false)
</script>

<template>
  <div
    v-if="isActive"
    :class="cn(
      'absolute -right-1',
      'h-2 w-2 rounded-full',
      'bg-primary',
      'transition-all duration-200',
      props.class,
    )"
  />
</template>
