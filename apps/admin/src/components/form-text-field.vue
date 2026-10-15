<script setup lang="ts">
import { FieldDescription, FieldError } from '@repo/ui/components/field'
import { FormItem } from '@repo/ui/components/form'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'

/** Minimal shape of a TanStack Form field API used by this input. */
interface TextFieldApi {
  name: string
  state: {
    value: unknown
    meta: { errors: Array<string | { message: string | undefined } | undefined>, isTouched: boolean }
  }
  handleChange: (value: any) => void
  handleBlur: () => void
}

const { field, type = 'text' } = defineProps<{
  field: TextFieldApi
  label: string
  type?: string
  placeholder?: string
  autocomplete?: string
  description?: string
  disabled?: boolean
}>()

const id = computed(() => `field-${field.name}`)
const invalid = computed(() => field.state.meta.isTouched && field.state.meta.errors.length > 0)

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  field.handleChange(type === 'number' ? (value === '' ? undefined : Number(value)) : value)
}
</script>

<template>
  <FormItem>
    <slot name="label">
      <Label :for="id" :data-error="invalid" class="data-[error=true]:text-destructive">
        {{ label }}
      </Label>
    </slot>
    <Input
      :id="id"
      :name="field.name"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :model-value="(field.state.value as string | number | undefined) ?? ''"
      @input="onInput"
      @blur="field.handleBlur"
    />
    <FieldDescription v-if="description">
      {{ description }}
    </FieldDescription>
    <FieldError v-if="invalid" :errors="field.state.meta.errors" />
  </FormItem>
</template>
