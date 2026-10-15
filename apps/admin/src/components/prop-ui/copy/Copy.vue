<script setup lang="ts">
import type { ButtonVariants } from '@repo/ui/components/button'
import type { HTMLAttributes } from 'vue'

import { CopyCheckIcon, CopyIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { cn } from '@repo/ui/lib/utils'
import { useClipboard } from '@vueuse/core'

interface Props {
  content: string
  size?: ButtonVariants['size']
  variant?: ButtonVariants['variant']
  class?: HTMLAttributes['class']
  copyTooltipText?: string
  copiedTooltipText?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  variant: 'outline',
  copyTooltipText: 'Copy',
  copiedTooltipText: 'Copied',
})

const source = computed(() => props.content)

const { copy, copied, isSupported } = useClipboard({ source })
</script>

<template>
  <span v-if="isSupported">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            :variant="props.variant"
            :size="size"
            :class="cn(props.class)"
            @click="copy(source)"
          >
            <CopyIcon v-if="!copied" />
            <CopyCheckIcon v-else />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p v-if="!copied">{{ props.copyTooltipText }}: {{ props.content }}</p>
          <p v-else>{{ props.copiedTooltipText }}: {{ props.content }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </span>
  <span v-else>Your browser does not support Clipboard API</span>
</template>
