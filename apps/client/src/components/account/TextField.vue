<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { useId } from 'vue'

defineProps<{
  label: string
  type?: string
  placeholder?: string
  autocomplete?: string
  inputmode?: HTMLAttributes['inputmode']
  maxlength?: number
  error?: string
  hint?: string
  disabled?: boolean
}>()

const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <Label :for="id" :class="error ? 'text-destructive' : ''">
        {{ label }}
      </Label>
      <slot name="label-end" />
    </div>
    <Input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :disabled="disabled"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
    />
    <p v-if="error" :id="`${id}-help`" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-help`" class="text-xs text-muted-foreground">
      {{ hint }}
    </p>
  </div>
</template>
