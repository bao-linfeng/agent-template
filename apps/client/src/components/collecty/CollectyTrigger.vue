<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { CollectyVariants } from '.'
import type { SectionData } from '@/types/collecty'
import { Bookmark } from '@lucide/vue'
import { cn } from '@repo/utils'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { collectyVariants } from '.'

const props = withDefaults(defineProps<{
  variant?: CollectyVariants['variant']
  size?: CollectyVariants['size']
  class?: HTMLAttributes['class']
}>(), {
  variant: 'default',
  size: 'md',
})

const { t } = useI18n()
const sectionData = inject<SectionData>('section-data')

// Проверяем состояние в коллекции
const isActive = computed(() => sectionData?.isInCollection.value || false)

function handleClick() {
  sectionData?.toggleCollection()
}
</script>

<template>
  <button
    type="button"
    :class="cn(
      collectyVariants({
        variant,
        size,
        state: isActive ? 'active' : 'inactive',
      }),
      props.class,
    )"
    @click="handleClick"
  >
    <Bookmark
      :class="cn(
        'transition-transform duration-200',
        { 'fill-current text-primary': isActive },
      )"
      :aria-label="isActive ? t('collecty.remove') : t('collecty.add')"
    />
  </button>
</template>
