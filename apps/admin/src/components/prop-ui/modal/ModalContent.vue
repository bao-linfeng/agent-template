<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@repo/ui/lib/utils'
import { useForwardPropsEmits } from 'reka-ui'

import { useModal } from './use-modal'

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()

const { Modal, contentClass } = useModal()

const forwarded = useForwardPropsEmits(props, emits)

const mergedClass = computed(() => cn(contentClass.value, props.class))
</script>

<template>
  <component
    :is="Modal.Content"
    v-bind="forwarded"
    :class="mergedClass"
  >
    <slot />
  </component>
</template>
