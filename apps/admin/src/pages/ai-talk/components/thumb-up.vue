<script setup lang="ts">
import { ThumbsUpIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@repo/ui/components/tooltip'
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" class="p-1">
          <ThumbsUpIcon class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Good Job</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
